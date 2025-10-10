#!/usr/bin/env bash

# Exit on any error
set -e

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Clean up and create dist directory
rm -rf "$SCRIPT_DIR/bin"
mkdir -p "$SCRIPT_DIR/bin"

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

# Install build tools
echo "📦 Installing build tools..."
"$PYTHON_BIN" -m pip install --upgrade pip setuptools wheel

# Create temporary directory for build
TEMP_DIR=$(mktemp -d)
echo "📦 Creating temporary build directory: $TEMP_DIR"

# Create package directory structure
mkdir -p "$TEMP_DIR/tigershark"

# Copy package files to temp directory
echo "📦 Copying package files to temporary directory..."
cp -r "$SCRIPT_DIR/src/tigershark"/* "$TEMP_DIR/tigershark/"
cp "$SCRIPT_DIR/src/tigershark/setup.py" "$TEMP_DIR/"

# Build the package in temp directory
echo "📦 Building Python package..."
cd "$TEMP_DIR"
"$PYTHON_BIN" setup.py sdist bdist_wheel
mv dist/* "$SCRIPT_DIR/bin/"

# Clean up temp directory
echo "🧹 Cleaning up temporary directory..."
rm -rf "$TEMP_DIR"
cd "$SCRIPT_DIR"

echo "✅ Created Python package in $SCRIPT_DIR/bin/"