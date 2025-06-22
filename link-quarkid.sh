#!/bin/bash

# Script to link local QuarkID packages to the register app
# Enables local development with BSV extensions

set -e

echo "🔗 Linking QuarkID packages for local development..."

# Get absolute paths
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REGISTER_DIR="$(realpath "$SCRIPT_DIR")"

# Look for Paquetes-NPMjs repo in parent directory
PARENT_DIR="$(dirname "$REGISTER_DIR")"
PAQUETES_REPO_DIR="$PARENT_DIR/Paquetes-NPMjs"

# Check if the repository exists
if [ ! -d "$PAQUETES_REPO_DIR" ]; then
    echo "❌ Error: Paquetes-NPMjs repository not found at $PAQUETES_REPO_DIR"
    echo "Please ensure the jonesjBSV/Paquetes-NPMjs repository is cloned in the parent directory"
    echo "Run: cd $PARENT_DIR && git clone git@github.com:jonesjBSV/Paquetes-NPMjs.git"
    exit 1
fi

# Get absolute path to packages directory
QUARKID_PACKAGES_DIR="$(realpath "$PAQUETES_REPO_DIR/packages")"

# Verify the packages directory exists
if [ ! -d "$QUARKID_PACKAGES_DIR" ]; then
    echo "❌ Error: Packages directory not found at $QUARKID_PACKAGES_DIR"
    exit 1
fi

# Verify directory paths
echo "🔍 Register directory: $REGISTER_DIR"
echo "🔍 QuarkID packages directory: $QUARKID_PACKAGES_DIR"

# Function to link a package
link_package() {
    local package_dir="$1"
    local package_name="$2"

    echo "📦 Linking $package_name..."

    # Navigate to package directory
    cd "$QUARKID_PACKAGES_DIR/$package_dir"

    # Clean previous builds and dependencies
    echo "  Cleaning previous build artifacts..."
    rm -rf node_modules package-lock.json dist

    # Link any previously built local packages BEFORE npm install
    echo "  Linking local @quarkid dependencies..."
    if [ "$package_name" != "@quarkid/kms-core" ]; then
        npm link @quarkid/kms-core 2>/dev/null || true
    fi
    if [ "$package_name" != "@quarkid/kms-client" ] && [ "$package_name" != "@quarkid/kms-core" ]; then
        npm link @quarkid/kms-client 2>/dev/null || true
    fi
    if [ "$package_name" != "@quarkid/vc-core" ] && [ "$package_name" != "@quarkid/kms-core" ] && [ "$package_name" != "@quarkid/kms-client" ]; then
        npm link @quarkid/vc-core 2>/dev/null || true
    fi
    if [ "$package_name" != "@quarkid/did-core" ] && [ "$package_name" != "@quarkid/kms-core" ] && [ "$package_name" != "@quarkid/kms-client" ] && [ "$package_name" != "@quarkid/vc-core" ]; then
        npm link @quarkid/did-core 2>/dev/null || true
    fi
    if [ "$package_name" != "@quarkid/did-registry" ] && [ "$package_name" != "@quarkid/did-core" ]; then
        npm link @quarkid/did-registry 2>/dev/null || true
    fi

    # Install dependencies with legacy peer deps
    echo "  Installing dependencies for $package_name..."
    npm install --legacy-peer-deps

    echo "  Building $package_name..."

    # Build the package
    if ! npm run build; then
        echo "  ❌ Build failed for $package_name"
        echo "  Attempting to continue..."
    fi

    # Create global link
    echo "  Creating global link for $package_name..."
    npm link

    echo "  ✅ $package_name linked globally"
}

echo ""
echo "=== Step 1: Building and linking QuarkID packages globally ==="

# Link core packages in dependency order
# First, link the KMS packages (no dependencies on other local packages)
link_package "kms/core" "@quarkid/kms-core"

# Then link DID core (no dependencies on other local packages)
link_package "did/core" "@quarkid/did-core"

# Then link VC core (depends on did-core)
link_package "vc/core" "@quarkid/vc-core"

# Then link KMS client (depends on kms-core)
link_package "kms/client" "@quarkid/kms-client"

# Then link DID registry (depends on did-core, kms-client)
link_package "did/registry" "@quarkid/did-registry"

# Finally link agent (depends on kms-core, kms-client, vc-core, did-core)
link_package "agent/core" "@quarkid/agent"

echo ""
echo "=== Step 2: Linking QuarkID packages in register app ==="

# Return safely to the register directory
cd "$REGISTER_DIR"

# Clean the backend node_modules to ensure fresh linking
echo "📦 Cleaning register backend dependencies..."
cd "$REGISTER_DIR/back"
rm -rf node_modules package-lock.json

echo "📦 Linking QuarkID core packages to register app..."
npm link @quarkid/kms-core
npm link @quarkid/kms-client
npm link @quarkid/vc-core
npm link @quarkid/did-core
npm link @quarkid/did-registry
npm link @quarkid/agent

echo "📦 Installing remaining register app dependencies..."
npm install --legacy-peer-deps

echo "  ✅ QuarkID packages linked to register app"

echo ""
echo "🎉 All QuarkID packages linked successfully!"
echo ""
echo "👉 Next steps:"
echo "  1. Restart your register app server."
echo "  2. Changes in QuarkID packages now reflect instantly."
echo "  3. Run 'npm run build' in QuarkID packages after making changes."
echo ""
echo "🧹 To unlink packages (for production readiness):"
echo "  cd $REGISTER_DIR/back"
echo "  npm unlink @quarkid/kms-core @quarkid/kms-client @quarkid/vc-core @quarkid/did-core @quarkid/did-registry @quarkid/agent"
echo "  npm install"
