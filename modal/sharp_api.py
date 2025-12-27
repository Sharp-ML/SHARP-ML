"""
Apple Sharp Model API - Modal Deployment

This script deploys the Apple Sharp model as a serverless API endpoint on Modal.
Sharp converts single images into 3D Gaussian splats (SOG format).

SOG (Spatially Ordered Gaussians) is a highly compressed format developed by PlayCanvas
that achieves 15-20x smaller file sizes than PLY through quantization.

PERFORMANCE: Model is loaded once at container start, inference takes <1 second.

Usage:
    # Deploy to development environment
    modal deploy --env dev sharp_api.py
    
    # Deploy to production environment (main)
    modal deploy --env main sharp_api.py
    
    # Run locally for testing
    modal serve sharp_api.py

Environments:
    dev:  Development environment for testing
    main: Production environment (default Modal environment)
"""

import modal
import io
import base64
import tempfile
import os
from pathlib import Path

# App name is always the same - environments separate dev from prod
app = modal.App("apple-sharp")

print(f"Modal app: apple-sharp")

# Define the container image with all dependencies
# IMAGE_VERSION: v16-20241226 - SOG format output
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
        # SOG encoding dependencies
        "scikit-learn>=1.3.0",  # For k-means codebook generation
    )
    .run_commands(
        # Clone the Sharp repository
        "git clone https://github.com/apple/ml-sharp.git /opt/ml-sharp",
        # Install Sharp package (no-deps since we've installed everything)
        "cd /opt/ml-sharp && pip install -e . --no-deps",
        # Verify all key imports work
        "python -c 'from sharp.models import create_predictor, PredictorParams; print(\"Sharp model imports OK\")'",
        # Force cache bust
        "echo 'Image built: 2024-12-26-v16-sog-format'",
    )
)

# Volume to cache the model weights
model_cache = modal.Volume.from_name("sharp-model-cache", create_if_missing=True)

MODEL_CACHE_PATH = "/cache/models"
DEFAULT_MODEL_URL = "https://ml-site.cdn-apple.com/models/sharp/sharp_2572gikvuh.pt"


# =============================================================================
# OPTIMIZED GPU-BASED POSTPROCESSING
# The original Sharp code moves tensors to CPU for SVD and scipy for quaternions.
# These functions keep everything on GPU for ~10x speedup.
# =============================================================================

def quaternions_from_rotation_matrices_gpu(matrices: "torch.Tensor") -> "torch.Tensor":
    """
    Pure PyTorch GPU implementation of rotation matrix to quaternion conversion.
    Avoids the CPU/scipy bottleneck in the original Sharp code.
    
    Based on the Shepperd method for numerical stability.
    Input: (..., 3, 3) rotation matrices
    Output: (..., 4) quaternions [w, x, y, z]
    """
    import torch
    
    batch_shape = matrices.shape[:-2]
    matrices = matrices.reshape(-1, 3, 3)
    
    # Extract matrix elements
    m00, m01, m02 = matrices[:, 0, 0], matrices[:, 0, 1], matrices[:, 0, 2]
    m10, m11, m12 = matrices[:, 1, 0], matrices[:, 1, 1], matrices[:, 1, 2]
    m20, m21, m22 = matrices[:, 2, 0], matrices[:, 2, 1], matrices[:, 2, 2]
    
    # Compute quaternion components using Shepperd's method
    trace = m00 + m11 + m22
    
    # Allocate output
    quaternions = torch.zeros(matrices.shape[0], 4, device=matrices.device, dtype=matrices.dtype)
    
    # Case 1: trace > 0
    mask1 = trace > 0
    if mask1.any():
        s = torch.sqrt(trace[mask1] + 1.0) * 2  # s = 4 * w
        quaternions[mask1, 0] = 0.25 * s
        quaternions[mask1, 1] = (m21[mask1] - m12[mask1]) / s
        quaternions[mask1, 2] = (m02[mask1] - m20[mask1]) / s
        quaternions[mask1, 3] = (m10[mask1] - m01[mask1]) / s
    
    # Case 2: m00 > m11 and m00 > m22
    mask2 = (~mask1) & (m00 > m11) & (m00 > m22)
    if mask2.any():
        s = torch.sqrt(1.0 + m00[mask2] - m11[mask2] - m22[mask2]) * 2  # s = 4 * x
        quaternions[mask2, 0] = (m21[mask2] - m12[mask2]) / s
        quaternions[mask2, 1] = 0.25 * s
        quaternions[mask2, 2] = (m01[mask2] + m10[mask2]) / s
        quaternions[mask2, 3] = (m02[mask2] + m20[mask2]) / s
    
    # Case 3: m11 > m22
    mask3 = (~mask1) & (~mask2) & (m11 > m22)
    if mask3.any():
        s = torch.sqrt(1.0 + m11[mask3] - m00[mask3] - m22[mask3]) * 2  # s = 4 * y
        quaternions[mask3, 0] = (m02[mask3] - m20[mask3]) / s
        quaternions[mask3, 1] = (m01[mask3] + m10[mask3]) / s
        quaternions[mask3, 2] = 0.25 * s
        quaternions[mask3, 3] = (m12[mask3] + m21[mask3]) / s
    
    # Case 4: remaining (m22 is largest)
    mask4 = (~mask1) & (~mask2) & (~mask3)
    if mask4.any():
        s = torch.sqrt(1.0 + m22[mask4] - m00[mask4] - m11[mask4]) * 2  # s = 4 * z
        quaternions[mask4, 0] = (m10[mask4] - m01[mask4]) / s
        quaternions[mask4, 1] = (m02[mask4] + m20[mask4]) / s
        quaternions[mask4, 2] = (m12[mask4] + m21[mask4]) / s
        quaternions[mask4, 3] = 0.25 * s
    
    # Normalize quaternions
    quaternions = quaternions / torch.linalg.norm(quaternions, dim=-1, keepdim=True)
    
    # Reshape to original batch shape
    return quaternions.reshape(batch_shape + (4,))


def fast_decompose_covariance_matrices_gpu(covariance_matrices: "torch.Tensor"):
    """GPU-optimized SVD decomposition - stays entirely on GPU."""
    import torch
    
    device = covariance_matrices.device
    dtype = covariance_matrices.dtype
    
    # Keep on GPU! The original code does .cpu() here which is the bottleneck
    rotations, singular_values_2, _ = torch.linalg.svd(covariance_matrices)
    
    # Fix reflection matrices (same logic as original)
    det = torch.linalg.det(rotations)
    reflection_mask = det < 0
    if reflection_mask.any():
        # Flip the last column of reflections to make them rotations
        rotations[reflection_mask, :, -1] *= -1
    
    # Use our pure PyTorch GPU implementation instead of scipy
    quaternions = quaternions_from_rotation_matrices_gpu(rotations)
    singular_values = singular_values_2.sqrt()
    
    return quaternions.to(dtype=dtype), singular_values.to(dtype=dtype)


def fast_apply_transform_gpu(gaussians: "Gaussians3D", transform: "torch.Tensor"):
    """GPU-optimized transform - uses fast GPU SVD."""
    import torch
    from sharp.utils.gaussians import Gaussians3D, compose_covariance_matrices
    
    transform_linear = transform[..., :3, :3]
    transform_offset = transform[..., :3, 3]

    mean_vectors = gaussians.mean_vectors @ transform_linear.T + transform_offset
    covariance_matrices = compose_covariance_matrices(
        gaussians.quaternions, gaussians.singular_values
    )
    covariance_matrices = (
        transform_linear @ covariance_matrices @ transform_linear.transpose(-1, -2)
    )
    
    # Use our fast GPU-based decomposition instead of the slow CPU one
    quaternions, singular_values = fast_decompose_covariance_matrices_gpu(covariance_matrices)

    return Gaussians3D(
        mean_vectors=mean_vectors,
        singular_values=singular_values,
        quaternions=quaternions,
        colors=gaussians.colors,
        opacities=gaussians.opacities,
    )


def fast_unproject_gaussians_gpu(gaussians_ndc, extrinsics, intrinsics, image_shape):
    """GPU-optimized unprojection - keeps all ops on GPU."""
    from sharp.utils.gaussians import get_unprojection_matrix
    
    unprojection_matrix = get_unprojection_matrix(extrinsics, intrinsics, image_shape)
    gaussians = fast_apply_transform_gpu(gaussians_ndc, unprojection_matrix[:3])
    return gaussians


# =============================================================================
# SOG (Spatially Ordered Gaussians) ENCODER
# Implements the PlayCanvas SOG format for efficient web delivery.
# SOG files are 15-20x smaller than PLY through quantization.
# =============================================================================

def compute_morton_order(positions: "np.ndarray") -> "np.ndarray":
    """
    Compute Morton (Z-order) curve indices for spatial ordering.
    This improves cache coherence during rendering.
    
    Args:
        positions: (N, 3) array of 3D positions
        
    Returns:
        (N,) array of indices that sort positions by Morton order
    """
    import numpy as np
    
    # Normalize positions to [0, 1] range
    mins = positions.min(axis=0)
    maxs = positions.max(axis=0)
    ranges = maxs - mins
    ranges[ranges == 0] = 1.0  # Avoid division by zero
    normalized = (positions - mins) / ranges
    
    # Quantize to 10-bit integers (gives 1024^3 = 1 billion possible codes)
    quantized = (normalized * 1023).astype(np.uint32).clip(0, 1023)
    
    # Interleave bits to create Morton code
    def spread_bits(x):
        """Spread 10 bits of x into 30 bits with 2 zeros between each bit."""
        x = (x | (x << 16)) & 0x030000FF
        x = (x | (x << 8)) & 0x0300F00F
        x = (x | (x << 4)) & 0x030C30C3
        x = (x | (x << 2)) & 0x09249249
        return x
    
    morton_codes = (
        spread_bits(quantized[:, 0]) |
        (spread_bits(quantized[:, 1]) << 1) |
        (spread_bits(quantized[:, 2]) << 2)
    )
    
    return np.argsort(morton_codes)


def build_codebook(values: "np.ndarray", n_clusters: int = 256) -> tuple:
    """
    Build a codebook using k-means clustering.
    
    Args:
        values: (N,) or (N, D) array of values to quantize
        n_clusters: Number of codebook entries (default 256 for 8-bit indices)
        
    Returns:
        (codebook, indices) - codebook entries and per-value indices
    """
    import numpy as np
    from sklearn.cluster import KMeans
    
    # Reshape to 2D if needed
    values_2d = values.reshape(-1, 1) if values.ndim == 1 else values
    
    # Handle case where we have fewer unique values than clusters
    n_unique = len(np.unique(values_2d, axis=0))
    actual_clusters = min(n_clusters, n_unique)
    
    # Run k-means
    kmeans = KMeans(n_clusters=actual_clusters, random_state=42, n_init=3, max_iter=100)
    indices = kmeans.fit_predict(values_2d)
    codebook = kmeans.cluster_centers_
    
    # Pad codebook if needed (shouldn't happen often)
    if actual_clusters < n_clusters:
        padding = np.zeros((n_clusters - actual_clusters, codebook.shape[1]))
        codebook = np.vstack([codebook, padding])
    
    return codebook.squeeze(), indices.astype(np.uint8)


def encode_positions_sog(positions: "np.ndarray") -> tuple:
    """
    Encode positions for SOG format using 16-bit quantization with log transform.
    
    The SOG format applies a log transform to handle varying scales:
    log(x) = sign(x) * ln(1 + |x|)
    
    Positions are then quantized to 16-bit and split into upper/lower bytes.
    
    Args:
        positions: (N, 3) array of 3D positions
        
    Returns:
        (means_l, means_u, mins, maxs) - lower/upper byte images and ranges
    """
    import numpy as np
    
    # Apply log transform for better precision across scales
    def log_transform(x):
        return np.sign(x) * np.log1p(np.abs(x))
    
    log_positions = log_transform(positions)
    
    # Get range for quantization
    mins = log_positions.min(axis=0)
    maxs = log_positions.max(axis=0)
    ranges = maxs - mins
    ranges[ranges == 0] = 1.0  # Avoid division by zero
    
    # Quantize to 16-bit (0-65535)
    normalized = (log_positions - mins) / ranges
    quantized = (normalized * 65535).astype(np.uint16).clip(0, 65535)
    
    # Split into upper and lower 8 bits
    means_l = (quantized & 0xFF).astype(np.uint8)  # Lower 8 bits
    means_u = (quantized >> 8).astype(np.uint8)    # Upper 8 bits
    
    return means_l, means_u, mins.tolist(), maxs.tolist()


def encode_quaternions_sog(quaternions: "np.ndarray") -> "np.ndarray":
    """
    Encode quaternions using the "smallest-three" scheme.
    
    We store only 3 components (the smallest in magnitude), 
    using 2 bits to indicate which component was dropped.
    The dropped component can be reconstructed from unit quaternion constraint.
    
    Args:
        quaternions: (N, 4) array of unit quaternions [w, x, y, z]
        
    Returns:
        (N, 4) uint8 array - R,G,B hold 3 components, A holds mode (2 bits)
    """
    import numpy as np
    
    # Ensure quaternions are normalized
    norms = np.linalg.norm(quaternions, axis=1, keepdims=True)
    quaternions = quaternions / np.where(norms > 0, norms, 1)
    
    # Find the component with largest absolute value (to be dropped)
    abs_q = np.abs(quaternions)
    dropped_idx = np.argmax(abs_q, axis=1)
    
    # Ensure the dropped component is positive (flip quaternion if needed)
    # This is valid because q and -q represent the same rotation
    signs = np.sign(quaternions[np.arange(len(quaternions)), dropped_idx])
    signs[signs == 0] = 1
    quaternions = quaternions * signs[:, np.newaxis]
    
    # Create mask for the three kept components
    n = len(quaternions)
    result = np.zeros((n, 4), dtype=np.uint8)
    
    # For each possible dropped component, extract the other three
    # Range for stored components: [-sqrt(2)/2, +sqrt(2)/2] mapped to [0, 255]
    sqrt2_over_2 = np.sqrt(2) / 2
    
    for i in range(n):
        drop = dropped_idx[i]
        # Get the three kept components in order
        kept = [j for j in range(4) if j != drop]
        values = quaternions[i, kept]
        
        # Map from [-sqrt(2)/2, sqrt(2)/2] to [0, 255]
        # Clamp values to valid range
        values = np.clip(values, -sqrt2_over_2, sqrt2_over_2)
        mapped = ((values / sqrt2_over_2 + 1) * 127.5).astype(np.uint8)
        
        result[i, :3] = mapped
        result[i, 3] = drop  # Mode indicates which component was dropped
    
    return result


def encode_scales_sog(scales: "np.ndarray") -> tuple:
    """
    Encode scales using a codebook.
    
    Args:
        scales: (N, 3) array of scale values (already in log space from Sharp)
        
    Returns:
        (indices, codebook) - per-axis indices and codebook entries
    """
    import numpy as np
    
    # Build separate codebooks for each axis, then combine
    all_scales = scales.flatten()
    codebook, _ = build_codebook(all_scales, n_clusters=256)
    
    # Find closest codebook entry for each scale value
    indices = np.zeros(scales.shape, dtype=np.uint8)
    for i in range(3):
        # Vectorized closest match
        dists = np.abs(scales[:, i:i+1] - codebook[np.newaxis, :])
        indices[:, i] = np.argmin(dists, axis=1)
    
    return indices, codebook.tolist()


def encode_colors_opacity_sog(colors: "np.ndarray", opacities: "np.ndarray") -> tuple:
    """
    Encode colors (SH0 DC component) and opacity for SOG format.
    
    Colors use a codebook, opacity is directly quantized to 8-bit.
    
    Args:
        colors: (N, 3) array of SH0 DC coefficients
        opacities: (N,) array of opacity values [0, 1]
        
    Returns:
        (sh0_data, color_codebook) - RGBA image data and color codebook
    """
    import numpy as np
    
    n = len(colors)
    
    # Build codebook for all color channels combined
    all_colors = colors.flatten()
    color_codebook, _ = build_codebook(all_colors, n_clusters=256)
    
    # Find closest codebook entry for each color channel
    color_indices = np.zeros((n, 3), dtype=np.uint8)
    for i in range(3):
        dists = np.abs(colors[:, i:i+1] - color_codebook[np.newaxis, :])
        color_indices[:, i] = np.argmin(dists, axis=1)
    
    # Quantize opacity to 8-bit
    opacity_u8 = (np.clip(opacities, 0, 1) * 255).astype(np.uint8)
    
    # Combine into RGBA
    sh0_data = np.zeros((n, 4), dtype=np.uint8)
    sh0_data[:, :3] = color_indices
    sh0_data[:, 3] = opacity_u8
    
    return sh0_data, color_codebook.tolist()


def array_to_webp_bytes(data: "np.ndarray", width: int, height: int) -> bytes:
    """
    Convert a numpy array to lossless WebP image bytes.
    
    Args:
        data: (N, C) array where C is 3 (RGB) or 4 (RGBA)
        width: Image width
        height: Image height
        
    Returns:
        WebP image as bytes
    """
    import numpy as np
    from PIL import Image
    import io
    
    channels = data.shape[1] if data.ndim > 1 else 1
    
    # Reshape to image dimensions
    if channels == 1:
        img_array = data.reshape(height, width)
        mode = 'L'
    elif channels == 3:
        img_array = data.reshape(height, width, 3)
        mode = 'RGB'
    else:  # 4 channels
        img_array = data.reshape(height, width, 4)
        mode = 'RGBA'
    
    img = Image.fromarray(img_array.astype(np.uint8), mode=mode)
    
    buffer = io.BytesIO()
    img.save(buffer, format='WEBP', lossless=True)
    return buffer.getvalue()


def save_sog_bytes(gaussians, f_px: float, image_shape: tuple) -> bytes:
    """
    Save Gaussians to SOG (Spatially Ordered Gaussians) format.
    
    SOG is a highly compressed format developed by PlayCanvas that uses:
    - 16-bit quantized positions split across two WebP images
    - Smallest-three quaternion encoding
    - Codebook-based scale and color compression
    - Morton curve ordering for cache efficiency
    
    Args:
        gaussians: Gaussians3D object from Sharp
        f_px: Focal length in pixels
        image_shape: (height, width) of the input image
        
    Returns:
        SOG archive as bytes (tar format)
    """
    import torch
    import numpy as np
    import json
    import tarfile
    import io
    from sharp.utils import color_space as cs_utils
    from sharp.utils.gaussians import convert_rgb_to_spherical_harmonics
    
    print("  Encoding SOG format...")
    
    # Move everything to CPU
    with torch.no_grad():
        xyz = gaussians.mean_vectors.flatten(0, 1).cpu().numpy()
        scales_log = torch.log(gaussians.singular_values).flatten(0, 1).cpu().numpy()
        quaternions = gaussians.quaternions.flatten(0, 1).cpu().numpy()
        colors_linear = gaussians.colors.flatten(0, 1).cpu()
        opacities = gaussians.opacities.flatten(0, 1).cpu().numpy()
        
        # Convert colors to sRGB and then to SH coefficients
        colors_srgb = cs_utils.linearRGB2sRGB(colors_linear)
        colors_sh = convert_rgb_to_spherical_harmonics(colors_srgb).numpy()
    
    num_gaussians = len(xyz)
    print(f"    Processing {num_gaussians} gaussians...")
    
    # Sort by Morton order for cache efficiency
    morton_order = compute_morton_order(xyz)
    xyz = xyz[morton_order]
    scales_log = scales_log[morton_order]
    quaternions = quaternions[morton_order]
    colors_sh = colors_sh[morton_order]
    opacities = opacities[morton_order]
    
    # Calculate image dimensions for the WebP files
    # We want roughly square images, with width being a multiple of 4 for efficiency
    width = int(np.ceil(np.sqrt(num_gaussians) / 4) * 4)
    height = int(np.ceil(num_gaussians / width))
    total_pixels = width * height
    
    # Pad arrays to fill the image
    pad_size = total_pixels - num_gaussians
    if pad_size > 0:
        xyz = np.vstack([xyz, np.zeros((pad_size, 3))])
        scales_log = np.vstack([scales_log, np.zeros((pad_size, 3))])
        quaternions = np.vstack([quaternions, np.zeros((pad_size, 4))])
        colors_sh = np.vstack([colors_sh, np.zeros((pad_size, 3))])
        opacities = np.concatenate([opacities, np.zeros(pad_size)])
    
    # Encode positions
    means_l, means_u, pos_mins, pos_maxs = encode_positions_sog(xyz)
    
    # Encode quaternions
    quats_encoded = encode_quaternions_sog(quaternions)
    
    # Encode scales
    scales_indices, scales_codebook = encode_scales_sog(scales_log)
    
    # Encode colors and opacity
    sh0_data, color_codebook = encode_colors_opacity_sog(colors_sh, opacities)
    
    # Convert to WebP images
    means_l_webp = array_to_webp_bytes(means_l, width, height)
    means_u_webp = array_to_webp_bytes(means_u, width, height)
    quats_webp = array_to_webp_bytes(quats_encoded, width, height)
    scales_webp = array_to_webp_bytes(scales_indices, width, height)
    sh0_webp = array_to_webp_bytes(sh0_data, width, height)
    
    # Create metadata
    image_height, image_width = image_shape
    meta = {
        "version": [1, 0, 0],
        "numGaussians": num_gaussians,
        "imageWidth": width,
        "imageHeight": height,
        "means": {
            "mins": pos_mins,
            "maxs": pos_maxs,
            "files": ["means_l.webp", "means_u.webp"]
        },
        "scales": {
            "codebook": scales_codebook,
            "file": "scales.webp"
        },
        "quats": {
            "file": "quats.webp"
        },
        "sh0": {
            "codebook": color_codebook,
            "file": "sh0.webp"
        },
        "camera": {
            "focalLength": f_px,
            "imageWidth": image_width,
            "imageHeight": image_height
        }
    }
    
    # Bundle into tar archive
    sog_buffer = io.BytesIO()
    with tarfile.open(fileobj=sog_buffer, mode='w') as tar:
        # Add meta.json
        meta_bytes = json.dumps(meta, indent=2).encode('utf-8')
        meta_info = tarfile.TarInfo(name='meta.json')
        meta_info.size = len(meta_bytes)
        tar.addfile(meta_info, io.BytesIO(meta_bytes))
        
        # Add WebP files
        for name, data in [
            ('means_l.webp', means_l_webp),
            ('means_u.webp', means_u_webp),
            ('quats.webp', quats_webp),
            ('scales.webp', scales_webp),
            ('sh0.webp', sh0_webp),
        ]:
            info = tarfile.TarInfo(name=name)
            info.size = len(data)
            tar.addfile(info, io.BytesIO(data))
    
    sog_bytes = sog_buffer.getvalue()
    print(f"    SOG file size: {len(sog_bytes) / 1024:.1f} KB")
    
    return sog_bytes


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
            The SOG file containing 3D Gaussian splats as bytes
        """
        import time
        import torch
        import torch.nn.functional as F
        import numpy as np
        from PIL import Image
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
        postprocess_start = time.time()
        
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
        
        unproject_start = time.time()
        # Use fast GPU-based unprojection (original Sharp code moves to CPU for SVD)
        gaussians = fast_unproject_gaussians_gpu(
            gaussians_ndc,
            torch.eye(4, device=self.device),
            intrinsics_resized,
            internal_shape
        )
        if torch.cuda.is_available():
            torch.cuda.synchronize()
        unproject_time = time.time() - unproject_start
        print(f"  unproject_gaussians (GPU): {unproject_time:.3f}s")
        
        # Save to SOG format (in-memory, no temp files)
        save_start = time.time()
        sog_bytes = save_sog_bytes(gaussians, f_px, (height, width))
        save_time = time.time() - save_start
        print(f"  save_sog: {save_time:.3f}s")
        
        postprocess_time = time.time() - postprocess_start
        print(f"  postprocessing total: {postprocess_time:.3f}s")
        
        elapsed = time.time() - start_time
        print(f"Total processing time: {elapsed:.3f}s (inference: {inference_time:.3f}s)")
        
        return sog_bytes

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
                "sog_base64": "<base64-encoded SOG data>",
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
            sog_bytes = self.predict.local(image_bytes)
            
            # Encode result as base64
            sog_base64 = base64.b64encode(sog_bytes).decode("utf-8")
            
            return {
                "success": True,
                "sog_base64": sog_base64,
                "message": "3D Gaussian splats generated successfully using Apple Sharp (SOG format)"
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
        print("  Converts an image to 3D Gaussian splats (SOG format)")
        return
    
    image_path = sys.argv[1]
    
    print(f"Processing image: {image_path}")
    
    with open(image_path, "rb") as f:
        image_bytes = f.read()
    
    # Run prediction
    model = SharpModel()
    sog_bytes = model.predict.remote(image_bytes)
    
    # Save output
    output_path = Path(image_path).stem + "_gaussian.sog"
    with open(output_path, "wb") as f:
        f.write(sog_bytes)
    
    print(f"Saved 3D Gaussian splats to: {output_path}")
