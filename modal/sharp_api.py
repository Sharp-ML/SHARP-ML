"""
Apple Sharp Model API - Modal Deployment

This script deploys the Apple Sharp model as a serverless API endpoint on Modal.
Sharp converts single images into 3D Gaussian splats (PLY format).

PERFORMANCE: Model is loaded once at container start, inference takes <1 second.

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
# IMAGE_VERSION: v11-20241221 - Direct Python API (no subprocess)
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
        "click",  # CLI framework used by Sharp
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
        "python -c 'from sharp.models import create_predictor, PredictorParams; print(\"Sharp model imports OK\")'",
        # Force cache bust
        "echo 'Image built: 2024-12-21-v11-direct-python-api'",
    )
)

# Volume to cache the model weights
model_cache = modal.Volume.from_name("sharp-model-cache", create_if_missing=True)

MODEL_CACHE_PATH = "/cache/models"
DEFAULT_MODEL_URL = "https://ml-site.cdn-apple.com/models/sharp/sharp_2572gikvuh.pt"


@app.cls(
    image=sharp_image,
    gpu="A100",  # Use A10G GPU for cost-effective performance
    timeout=300,  # 5 minute timeout
    volumes={MODEL_CACHE_PATH: model_cache},
    scaledown_window=300,  # Keep container warm for 5 minutes
)
class SharpModel:
    """Sharp model class for image-to-3D Gaussian splat conversion.
    
    The model is loaded once when the container starts and kept in GPU memory
    for fast inference (<1 second per image).
    """

    @modal.enter()
    def load_model(self):
        """Load the Sharp model into GPU memory when the container starts."""
        import torch
        import subprocess
        import time
        
        start_time = time.time()
        
        # Set cache directory
        os.environ["TORCH_HOME"] = MODEL_CACHE_PATH
        
        # Determine device
        if torch.cuda.is_available():
            self.device = torch.device("cuda")
            print(f"Using CUDA device: {torch.cuda.get_device_name(0)}")
        else:
            self.device = torch.device("cpu")
            print("Warning: CUDA not available, using CPU")
        
        # Download checkpoint if not cached
        checkpoint_path = Path(MODEL_CACHE_PATH) / "sharp_2572gikvuh.pt"
        if not checkpoint_path.exists():
            print(f"Downloading Sharp model checkpoint from {DEFAULT_MODEL_URL}...")
            subprocess.run([
                "wget", "-q",
                DEFAULT_MODEL_URL,
                "-O", str(checkpoint_path)
            ], check=True)
            model_cache.commit()
            print("Model checkpoint downloaded and cached.")
        else:
            print("Using cached model checkpoint.")
        
        # Import Sharp modules
        from sharp.models import create_predictor, PredictorParams
        
        # Load the model weights
        print("Loading model weights...")
        state_dict = torch.load(checkpoint_path, weights_only=True, map_location=self.device)
        
        # Create and initialize the predictor
        print("Creating predictor model...")
        self.predictor = create_predictor(PredictorParams())
        self.predictor.load_state_dict(state_dict)
        self.predictor.eval()
        self.predictor.to(self.device)
        
        # Warmup: Run a dummy forward pass to ensure CUDA kernels are compiled
        print("Warming up model with dummy inference...")
        with torch.no_grad():
            import torch.nn.functional as F
            dummy_image = torch.randn(1, 3, 1536, 1536, device=self.device)
            dummy_disparity = torch.tensor([1.0], device=self.device)
            _ = self.predictor(dummy_image, dummy_disparity)
        
        # Sync CUDA to ensure warmup is complete
        if torch.cuda.is_available():
            torch.cuda.synchronize()
        
        elapsed = time.time() - start_time
        print(f"Sharp model loaded and ready in {elapsed:.2f}s!")

    @modal.method()
    def predict(self, image_bytes: bytes) -> bytes:
        """
        Convert an image to 3D Gaussian splats.
        
        Args:
            image_bytes: The input image as bytes (PNG, JPG, or WebP)
            
        Returns:
            The PLY file containing 3D Gaussian splats as bytes
        """
        import time
        import torch
        import torch.nn.functional as F
        import numpy as np
        from PIL import Image
        from sharp.utils.gaussians import save_ply, unproject_gaussians
        from sharp.utils.io import convert_focallength
        
        start_time = time.time()
        
        # Load and preprocess the image
        img_pil = Image.open(io.BytesIO(image_bytes))
        
        # Convert to RGB if necessary
        if img_pil.mode in ('RGBA', 'LA', 'P'):
            img_pil = img_pil.convert('RGB')
        elif img_pil.mode != 'RGB':
            img_pil = img_pil.convert('RGB')
        
        image = np.array(img_pil)
        height, width = image.shape[:2]
        
        # Calculate focal length (default to 30mm equivalent)
        # This matches Sharp's default behavior when EXIF is missing
        f_35mm = 30.0
        f_px = convert_focallength(width, height, f_35mm)
        
        print(f"Processing image: {width}x{height}, focal length: {f_px:.2f}px")
        
        # Internal resolution for Sharp model
        internal_shape = (1536, 1536)
        
        # Preprocess image
        image_pt = torch.from_numpy(image.copy()).float().to(self.device).permute(2, 0, 1) / 255.0
        disparity_factor = torch.tensor([f_px / width], device=self.device).float()
        
        image_resized = F.interpolate(
            image_pt[None],
            size=(internal_shape[1], internal_shape[0]),
            mode="bilinear",
            align_corners=True,
        )
        
        # Run inference
        print("Running inference...")
        inference_start = time.time()
        with torch.no_grad():
            gaussians_ndc = self.predictor(image_resized, disparity_factor)
        
        if torch.cuda.is_available():
            torch.cuda.synchronize()
        inference_time = time.time() - inference_start
        print(f"Inference completed in {inference_time:.3f}s")
        
        # Postprocess: Convert to metric space
        print("Running postprocessing...")
        intrinsics = torch.tensor(
            [
                [f_px, 0, width / 2, 0],
                [0, f_px, height / 2, 0],
                [0, 0, 1, 0],
                [0, 0, 0, 1],
            ],
            dtype=torch.float32,
            device=self.device
        )
        intrinsics_resized = intrinsics.clone()
        intrinsics_resized[0] *= internal_shape[0] / width
        intrinsics_resized[1] *= internal_shape[1] / height
        
        gaussians = unproject_gaussians(
            gaussians_ndc,
            torch.eye(4, device=self.device),
            intrinsics_resized,
            internal_shape
        )
        
        # Save to PLY file
        with tempfile.TemporaryDirectory() as tmpdir:
            ply_path = Path(tmpdir) / "output.ply"
            save_ply(gaussians, f_px, (height, width), ply_path)
            
            with open(ply_path, "rb") as f:
                ply_bytes = f.read()
        
        elapsed = time.time() - start_time
        print(f"Total processing time: {elapsed:.3f}s (inference: {inference_time:.3f}s)")
        
        return ply_bytes

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
            import traceback
            traceback.print_exc()
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
