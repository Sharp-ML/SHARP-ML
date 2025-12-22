"""
Apple Sharp Model API - Modal Deployment

This script deploys the Apple Sharp model as a serverless API endpoint on Modal.
Sharp converts single images into 3D Gaussian splats (PLY format).

Usage:
    # Deploy to Modal
    modal deploy sharp_api.py
    
    # Run locally for testing
    modal serve sharp_api.py
"""

import modal
import io
import base64
import tempfile
import os
from pathlib import Path

# Create the Modal app
app = modal.App("apple-sharp")

# Define the container image with all dependencies
# IMAGE_VERSION: v10-20241221 - Complete ml-sharp dependencies
sharp_image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install(
        "git",
        "wget",
        "libgl1-mesa-glx",
        "libglib2.0-0",
        "libsm6",
        "libxext6",
        "libxrender-dev",
        "ffmpeg",
        # Additional libs for opencv and open3d
        "libgomp1",
    )
    # Install ALL required packages explicitly (from ml-sharp requirements.txt)
    .pip_install(
        # Core ML packages
        "torch>=2.0.0",
        "torchvision",
        "numpy<2",  # ml-sharp requires numpy<2
        "Pillow>=9.0",
        # Sharp dependencies from requirements.txt
        "scipy>=1.11.0",
        "imageio>=2.31.0",
        "plyfile",
        "tqdm",
        "einops",
        "timm",
        "huggingface_hub",
        "pillow_heif",  # HEIF/HEIC image support
        "matplotlib",  # For sharp.utils.vis
        "opencv-python-headless",  # For image processing (headless for server)
        "trimesh",  # For 3D mesh operations
        "open3d",  # For 3D point cloud operations
        "safetensors",  # For model weight loading
        "moviepy==1.0.3",  # For video processing
        "e3nn",  # For equivariant neural networks
        "omegaconf",  # For configuration management
        "gsplat",  # Critical: Gaussian splatting library
        # API dependencies
        "fastapi",
        "requests>=2.31.0",
    )
    .run_commands(
        # Clone the Sharp repository
        "git clone https://github.com/apple/ml-sharp.git /opt/ml-sharp",
        # Install Sharp package (no-deps since we've installed everything)
        "cd /opt/ml-sharp && pip install -e . --no-deps",
        # Verify all key imports work
        "python -c 'from sharp.cli import main_cli; import requests; import imageio; print(\"All Sharp imports OK\")'",
        # Force cache bust
        "echo 'Image built: 2024-12-21-v10-complete-deps'",
    )
)

# Volume to cache the model weights
model_cache = modal.Volume.from_name("sharp-model-cache", create_if_missing=True)

MODEL_CACHE_PATH = "/cache/models"


@app.cls(
    image=sharp_image,
    gpu="H100",  # Use H100 GPU for best performance
    timeout=300,  # 5 minute timeout
    volumes={MODEL_CACHE_PATH: model_cache},
    scaledown_window=300,  # Keep container warm for 5 minutes
)
class SharpModel:
    """Sharp model class for image-to-3D Gaussian splat conversion."""

    @modal.enter()
    def load_model(self):
        """Load the Sharp model when the container starts."""
        import subprocess
        import sys
        
        # Set cache directory for the model
        os.environ["TORCH_HOME"] = MODEL_CACHE_PATH
        
        # Pre-download the model checkpoint if not already cached
        checkpoint_path = Path(MODEL_CACHE_PATH) / "sharp_2572gikvuh.pt"
        if not checkpoint_path.exists():
            print("Downloading Sharp model checkpoint...")
            subprocess.run([
                "wget", "-q",
                "https://ml-site.cdn-apple.com/models/sharp/sharp_2572gikvuh.pt",
                "-O", str(checkpoint_path)
            ], check=True)
            model_cache.commit()
            print("Model checkpoint downloaded and cached.")
        else:
            print("Using cached model checkpoint.")
        
        self.checkpoint_path = str(checkpoint_path)
        print("Sharp model ready!")

    @modal.method()
    def predict(self, image_bytes: bytes) -> bytes:
        """
        Convert an image to 3D Gaussian splats.
        
        Args:
            image_bytes: The input image as bytes (PNG, JPG, or WebP)
            
        Returns:
            The PLY file containing 3D Gaussian splats as bytes
        """
        import subprocess
        from PIL import Image
        
        # Create temporary directories for input and output
        with tempfile.TemporaryDirectory() as tmpdir:
            input_dir = Path(tmpdir) / "input"
            output_dir = Path(tmpdir) / "output"
            input_dir.mkdir()
            output_dir.mkdir()
            
            # Save the input image
            input_path = input_dir / "image.png"
            img = Image.open(io.BytesIO(image_bytes))
            # Convert to RGB if necessary (Sharp may not handle RGBA well)
            if img.mode in ('RGBA', 'LA', 'P'):
                img = img.convert('RGB')
            img.save(input_path, "PNG")
            
            # Run Sharp prediction
            print(f"Running Sharp prediction on {input_path}...")
            result = subprocess.run(
                [
                    "sharp", "predict",
                    "-i", str(input_dir),
                    "-o", str(output_dir),
                    "-c", self.checkpoint_path,
                ],
                capture_output=True,
                text=True,
                cwd="/opt/ml-sharp",
            )
            
            if result.returncode != 0:
                print(f"Sharp stderr: {result.stderr}")
                print(f"Sharp stdout: {result.stdout}")
                raise RuntimeError(f"Sharp prediction failed: {result.stderr}")
            
            print(f"Sharp stdout: {result.stdout}")
            
            # Find the output PLY file
            ply_files = list(output_dir.glob("**/*.ply"))
            if not ply_files:
                raise RuntimeError("No PLY file generated by Sharp")
            
            # Read and return the PLY file
            ply_path = ply_files[0]
            print(f"Generated PLY file: {ply_path}")
            
            with open(ply_path, "rb") as f:
                return f.read()

    @modal.fastapi_endpoint(method="POST")
    def generate(self, request: dict) -> dict:
        """
        Web endpoint for generating 3D Gaussian splats from an image.
        
        Request body:
            {
                "image": "<base64-encoded image data>",
                "image_url": "<URL to image>" (alternative to base64)
            }
            
        Response:
            {
                "success": true,
                "ply_base64": "<base64-encoded PLY data>",
                "message": "3D Gaussian splats generated successfully"
            }
        """
        try:
            # Get image data from request
            image_bytes = None
            
            if "image" in request and request["image"]:
                # Base64 encoded image
                image_bytes = base64.b64decode(request["image"])
            elif "image_url" in request and request["image_url"]:
                # Download from URL
                import requests
                response = requests.get(request["image_url"], timeout=30)
                response.raise_for_status()
                image_bytes = response.content
            else:
                return {
                    "success": False,
                    "error": "No image provided. Send 'image' (base64) or 'image_url'."
                }
            
            # Run prediction - use .local() to call the Modal method from within the class
            ply_bytes = self.predict.local(image_bytes)
            
            # Encode result as base64
            ply_base64 = base64.b64encode(ply_bytes).decode("utf-8")
            
            return {
                "success": True,
                "ply_base64": ply_base64,
                "message": "3D Gaussian splats generated successfully using Apple Sharp"
            }
            
        except Exception as e:
            print(f"Error during generation: {e}")
            return {
                "success": False,
                "error": str(e)
            }


@app.local_entrypoint()
def main():
    """Test the Sharp model locally."""
    import sys
    
    if len(sys.argv) < 2:
        print("Usage: modal run sharp_api.py -- <image_path>")
        print("  Converts an image to 3D Gaussian splats")
        return
    
    image_path = sys.argv[1]
    
    print(f"Processing image: {image_path}")
    
    with open(image_path, "rb") as f:
        image_bytes = f.read()
    
    # Run prediction
    model = SharpModel()
    ply_bytes = model.predict.remote(image_bytes)
    
    # Save output
    output_path = Path(image_path).stem + "_gaussian.ply"
    with open(output_path, "wb") as f:
        f.write(ply_bytes)
    
    print(f"Saved 3D Gaussian splats to: {output_path}")
