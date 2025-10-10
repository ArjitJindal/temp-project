#!/usr/bin/env bash

# Exit on any error
set -e

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
echo "SCRIPT_DIR: $SCRIPT_DIR"
# Clean up and create dist directory
rm -rf "$SCRIPT_DIR/dist"
mkdir -p "$SCRIPT_DIR/dist"

# Find Python 3.10 binary and verify it exists
PYTHON_BIN=$(which python3.10 || true)
[ -z "$PYTHON_BIN" ] && { echo "❌ Python 3.10 not found"; exit 1; }

# Verify Python version is exactly 3.10
PYTHON_VERSION=$("$PYTHON_BIN" -c "import sys; print(f'python{sys.version_info.major}.{sys.version_info.minor}')")
if [ "$PYTHON_VERSION" != "python3.10" ]; then
    echo "❌ Python version must be 3.10, found $PYTHON_VERSION"
    exit 1
fi
echo "🐍 Using Python version: $PYTHON_VERSION"

# Define paths to requirements files
DEFAULT_REQUIREMENTS="${SCRIPT_DIR}/requirements.txt"

# Function to build Tigershark layer with dependencies
build_tigershark() {
    echo "📦 Building Tigershark Layer with Python packages..."
    # Create temporary directory for layer build
    local temp_dir=$(mktemp -d)
    local site_packages_dir="$temp_dir/python/lib/$PYTHON_VERSION/site-packages"
    mkdir -p "$site_packages_dir"

    # Copy custom tigershark and create __init__.py
    touch "$site_packages_dir/tigershark/__init__.py"

    # Install dependencies from either tigershark-requirements.txt or requirements.txt
    if [ -f "$DEFAULT_REQUIREMENTS" ]; then
        echo "📄 Installing tigershark dependencies from requirements.txt"
        "$PYTHON_BIN" -m pip install --upgrade pip
        "$PYTHON_BIN" -m pip install --platform manylinux2014_x86_64 --target="$site_packages_dir" --implementation cp --python-version 3.10 --only-binary=:all: --upgrade -r "$DEFAULT_REQUIREMENTS" || { echo "❌ Failed to install dependencies"; exit 1; }
        echo "Current directory: $(pwd)"
        ./build_package.sh
        "$PYTHON_BIN" -m pip install --target="$site_packages_dir" bin/tigershark-0.1.0-py3-none-any.whl
    else
        echo "⚠️  No requirements file found"
    fi

    # Clean up Python cache files
    echo "🧹 Cleaning up installation..."
    find "$site_packages_dir" -type d -name "__pycache__" -exec rm -rf {} +
    find "$site_packages_dir" -type f -name "*.pyc" -delete
    find "$site_packages_dir" -type f -name "*.pyo" -delete
    find "$site_packages_dir" -type f -name "*.pyd" -delete

    # remove setuptools
    rm -rf "$site_packages_dir/setuptools"

    # Create zip archive of the tigershark layer
    (cd "$temp_dir" && zip -r "$SCRIPT_DIR/dist/tigershark.zip" python > /dev/null)
    rm -rf "$temp_dir"
    echo "✅ Created Tigershark layer: $SCRIPT_DIR/dist/tigershark.zip"
}

# Function to build individual Lambda functions
build_lambda() {
    local lambda_name=$1 lambda_path=$2
    echo "🛠️  Building Lambda: $lambda_name"
    local temp_dir=$(mktemp -d)
    cp -r "$lambda_path"/* "$temp_dir/"
    (cd "$temp_dir" && zip -r "$SCRIPT_DIR/dist/${lambda_name}.zip" . > /dev/null)
    rm -rf "$temp_dir"
    echo "✅ Created Lambda package: $SCRIPT_DIR/dist/${lambda_name}.zip"
}

# Build tigershark unless --skip-tigershark flag is provided
[ "$1" != "--skip-tigershark" ] && build_tigershark || echo "⏭️  Skipping tigershark build as requested"

# Build all Lambda functions in the lambdas directory
for lambda_dir in "$SCRIPT_DIR/src/lambdas"/*/; do
    [ -d "$lambda_dir" ] && build_lambda "$(basename "$lambda_dir")" "$lambda_dir"
done

echo "🎉 All packages created in $SCRIPT_DIR/dist/"
