#!/bin/bash

# Script to link local QuarkID packages to the register app
# Enables local development with BSV extensions

set -e

echo "🔗 Linking QuarkID packages for local development..."

# Corrected path definitions (script is at root of REGISTER_DIR)
REGISTER_DIR="$(pwd)"
QUARKID_PACKAGES_DIR="$(cd ../Paquetes-NPMjs/packages && pwd)"

# Verify directory paths (optional but recommended)
echo "🔍 Register directory: $REGISTER_DIR"
echo "🔍 QuarkID packages directory: $QUARKID_PACKAGES_DIR"

# Function to link a package
link_package() {
    local package_dir="$1"
    local package_name="$2"

    echo "📦 Linking $package_name..."

    # Navigate and build the package
    cd "$QUARKID_PACKAGES_DIR/$package_dir"
    echo "  Building $package_name..."

    # Special handling for agent package
    if [ "$package_name" = "@quarkid/agent" ]; then
        echo "  Using individual build for agent package..."
        npm run build:individual 2>/dev/null || npm run build 2>/dev/null || {
            echo "  Fallback to direct TypeScript compilation..."
            npx tsc
        }
    else
        npm run build
    fi

    # Create global link
    echo "  Creating global link for $package_name..."
    npm link

    echo "  ✅ $package_name linked globally"
}

echo ""
echo "=== Step 1: Building and linking QuarkID packages globally ==="

# Link core packages
link_package "did/core" "@quarkid/did-core"
link_package "did/registry" "@quarkid/did-registry"
link_package "agent/core" "@quarkid/agent"

echo ""
echo "=== Step 2: Linking QuarkID packages in register app ==="

# Return safely to the register directory
cd "$REGISTER_DIR"

echo "📦 Linking QuarkID core packages to register app..."
npm link @quarkid/did-core
npm link @quarkid/did-registry
npm link @quarkid/agent

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
echo "  cd $REGISTER_DIR"
echo "  npm unlink @quarkid/did-core @quarkid/did-registry @quarkid/agent"
echo "  npm install"
