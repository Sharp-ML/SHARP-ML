#!/bin/bash

# SHARP 3D - ml-sharp Setup Script
# This script sets up Apple's ml-sharp for converting images to 3D Gaussian splats

set -e

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║                    SHARP 3D Setup Script                     ║"
echo "║          Apple ml-sharp Installation & Configuration         ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

# Check for Python
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is not installed. Please install Python 3.11+ first."
    exit 1
fi

PYTHON_VERSION=$(python3 -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")')
echo "✓ Found Python $PYTHON_VERSION"

# Check for conda
USE_CONDA=false
if command -v conda &> /dev/null; then
    echo "✓ Found conda"
    USE_CONDA=true
else
    echo "⚠ conda not found. Using pip with venv instead."
fi

# Create ml-sharp directory
SHARP_DIR="$HOME/.sharp"
echo ""
echo "📁 Setting up SHARP in: $SHARP_DIR"

if [ -d "$SHARP_DIR" ]; then
    echo "⚠ SHARP directory already exists. Updating..."
else
    mkdir -p "$SHARP_DIR"
fi

cd "$SHARP_DIR"

# Clone or update ml-sharp repository
if [ -d "ml-sharp" ]; then
    echo "📥 Updating ml-sharp repository..."
    cd ml-sharp
    git pull origin main
else
    echo "📥 Cloning ml-sharp repository..."
    git clone https://github.com/apple/ml-sharp.git
    cd ml-sharp
fi

# Create and activate environment
if [ "$USE_CONDA" = true ]; then
    echo ""
    echo "🐍 Creating conda environment..."
    
    # Check if environment exists
    if conda env list | grep -q "sharp"; then
        echo "⚠ Conda environment 'sharp' already exists. Updating..."
        conda activate sharp || source activate sharp
    else
        conda create -n sharp python=3.13 -y
        conda activate sharp || source activate sharp
    fi
else
    echo ""
    echo "🐍 Creating virtual environment..."
    
    if [ -d "venv" ]; then
        echo "⚠ Virtual environment already exists. Reusing..."
    else
        python3 -m venv venv
    fi
    
    source venv/bin/activate
fi

# Install dependencies
echo ""
echo "📦 Installing dependencies..."
pip install --upgrade pip
pip install -r requirements.txt

# Verify installation
echo ""
echo "🔍 Verifying installation..."

if sharp --help > /dev/null 2>&1; then
    echo "✓ SHARP CLI is working!"
    echo ""
    echo "╔══════════════════════════════════════════════════════════════╗"
    echo "║                    ✅ Setup Complete!                        ║"
    echo "╚══════════════════════════════════════════════════════════════╝"
    echo ""
    echo "To use SHARP:"
    echo ""
    if [ "$USE_CONDA" = true ]; then
        echo "  1. Activate the environment:"
        echo "     conda activate sharp"
    else
        echo "  1. Activate the environment:"
        echo "     source $SHARP_DIR/ml-sharp/venv/bin/activate"
    fi
    echo ""
    echo "  2. Test with a sample image:"
    echo "     sharp predict -i /path/to/image.jpg -o /path/to/output/"
    echo ""
    echo "  3. The web app will automatically use SHARP when available."
    echo ""
else
    echo "❌ SHARP CLI installation failed."
    echo ""
    echo "Please try manual installation:"
    echo "  cd $SHARP_DIR/ml-sharp"
    if [ "$USE_CONDA" = true ]; then
        echo "  conda activate sharp"
    else
        echo "  source venv/bin/activate"
    fi
    echo "  pip install -r requirements.txt"
    exit 1
fi
