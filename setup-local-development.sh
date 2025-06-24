#!/bin/bash

# Script to set up local development environment for QuarkID register app
# This script ensures all QuarkID packages are built and properly linked

set -e

echo "🚀 Setting up QuarkID local development environment..."

# Get directory paths
REGISTER_DIR="$(pwd)"
QUARKID_PACKAGES_DIR="$(cd ../Paquetes-NPMjs/packages && pwd)"

echo "📁 Register directory: $REGISTER_DIR"
echo "📁 QuarkID packages directory: $QUARKID_PACKAGES_DIR"

# Function to build a package
build_package() {
    local package_dir="$1"
    local package_name="$2"
    
    echo "🔨 Building $package_name..."
    cd "$QUARKID_PACKAGES_DIR/$package_dir"
    
    # Check if package.json exists
    if [ ! -f "package.json" ]; then
        echo "  ⚠️  No package.json found in $package_dir, skipping..."
        return 0
    fi
    
    # Install dependencies if node_modules doesn't exist
    if [ ! -d "node_modules" ]; then
        echo "  📦 Installing dependencies for $package_name..."
        npm install
    fi
    
    # Build the package
    if npm run build 2>/dev/null; then
        echo "  ✅ $package_name built successfully"
    else
        echo "  ⚠️  Build failed for $package_name, trying TypeScript compilation..."
        if npx tsc 2>/dev/null; then
            echo "  ✅ $package_name compiled with TypeScript"
        else
            echo "  ❌ Failed to build $package_name"
            return 1
        fi
    fi
}

echo ""
echo "=== Step 1: Building QuarkID packages ==="

# Build core packages first (dependencies)
build_package "did/core" "@quarkid/did-core"
build_package "kms/core" "@quarkid/kms-core"
build_package "vc/core" "@quarkid/vc-core"

# Build KMS suites
build_package "kms/suite/es256k" "@quarkid/kms-suite-es256k"
build_package "kms/suite/bbsbls2020" "@quarkid/kms-suite-bbsbls2020"
build_package "kms/suite/didcomm" "@quarkid/kms-suite-didcomm"
build_package "kms/suite/didcomm-v2" "@quarkid/kms-suite-didcomm-v2"
build_package "kms/suite/jsonld" "@quarkid/kms-suite-jsonld"
build_package "kms/suite/rsa-signature-2018" "@quarkid/kms-suite-rsa-signature-2018"

# Build storage
build_package "kms/storage/vault" "@quarkid/kms-storage-vault"

# Build DID packages
build_package "did/registry" "@quarkid/did-registry"
build_package "did/resolver" "@quarkid/did-resolver"

# Build DWN packages
build_package "dwn/client" "@quarkid/dwn-client"
build_package "dwn/scheduler" "@quarkid/dwn-scheduler"

# Build KMS client
build_package "kms/client" "@quarkid/kms-client"

# Build VC verifier
build_package "vc/verifier" "@quarkid/vc-verifier"

# Build WACI
build_package "waci/core" "@quarkid/waci"

# Build Modena SDK
build_package "modena-sdk" "@quarkid/modena-sdk"

# Build agent plugins
build_package "agent/plugins/quarkid-status-list" "@quarkid/status-list-agent-plugin"

# Build agent core (last, as it depends on other packages)
build_package "agent/core" "@quarkid/agent"

echo ""
echo "=== Step 2: Installing dependencies in register app ==="

# Return to register directory
cd "$REGISTER_DIR"

# Clean existing node_modules and package-lock.json
echo "🧹 Cleaning existing node_modules..."
rm -rf back/node_modules back/package-lock.json
rm -rf front/node_modules front/package-lock.json
rm -rf overlay/node_modules overlay/package-lock.json

# Install dependencies in backend
echo "📦 Installing backend dependencies..."
cd back
npm install
cd ..

# Install dependencies in frontend
echo "📦 Installing frontend dependencies..."
cd front
npm install
cd ..

# Install dependencies in overlay
echo "📦 Installing overlay dependencies..."
cd overlay
npm install
cd ..

echo ""
echo "=== Step 3: Verifying setup ==="

# Check if packages are properly linked
echo "🔍 Verifying package links..."

cd back
echo "Backend @quarkid packages:"
ls -la node_modules/@quarkid/ | head -10
cd ..

cd front
echo "Frontend @quarkid packages:"
ls -la node_modules/@quarkid/
cd ..

echo ""
echo "🎉 Local development environment setup complete!"
echo ""
echo "👉 Next steps:"
echo "  1. Start MongoDB: docker run -d -p 27017:27017 --name mongodb mongo:latest"
echo "  2. Start the overlay service: cd overlay && npm start"
echo "  3. Start the backend: cd back && npm run dev"
echo "  4. Start the frontend: cd front && npm run dev"
echo ""
echo "📝 Notes:"
echo "  - All QuarkID packages now use local file: dependencies"
echo "  - Changes in Paquetes-NPMjs will be reflected immediately"
echo "  - Run 'npm run build' in individual packages after making changes"
echo "  - To switch back to published packages, update package.json files" 