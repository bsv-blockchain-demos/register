#!/bin/bash

# Script to link local QuarkID packages to the register app
# This allows development against local QuarkID packages with BSV extensions

set -e

echo "🔗 Linking QuarkID packages for local development..."

# Navigate to QuarkID packages directory
QUARKID_PACKAGES_DIR="/Users/jake/Desktop/quarkID/Paquetes-NPMjs/Paquetes-NPMjs/packages"
REGISTER_DIR="/Users/jake/Desktop/quarkID/Paquetes-NPMjs/register"

# Function to link a package
link_package() {
    local package_dir="$1"
    local package_name="$2"
    
    echo "📦 Linking $package_name..."
    
    # Build the package first
    cd "$QUARKID_PACKAGES_DIR/$package_dir"
    echo "  Building $package_name..."
    
    # Special handling for agent package to avoid workspace build issues
    if [ "$package_name" = "@quarkid/agent" ]; then
        echo "  Using individual build for agent package..."
        npm run build:individual 2>/dev/null || npm run build 2>/dev/null || (
            echo "  Trying TypeScript compilation directly..."
            npx tsc
        )
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

# Link core packages that build successfully
link_package "did/core" "@quarkid/did-core"
link_package "did/registry" "@quarkid/did-registry"

# Now that build issues are resolved, include the agent package
link_package "agent/core" "@quarkid/agent"

echo ""
echo "=== Step 2: Linking QuarkID packages in register app ==="

cd "$REGISTER_DIR"

echo "📦 Installing QuarkID core packages..."
npm link @quarkid/did-core
npm link @quarkid/did-registry
npm link @quarkid/agent
echo "  ✅ QuarkID packages linked to register app"

echo ""
echo "🎉 All QuarkID packages linked successfully!"
echo ""
echo "Next steps:"
echo "1. Restart your register app server"
echo "2. Any changes to QuarkID packages will now be reflected in the register app"
echo "3. Run 'npm run build' in QuarkID packages after making changes"
echo ""
echo "To unlink (when ready for production):"
echo "  cd /Users/jake/Desktop/quarkID/Paquetes-NPMjs/register/back"
echo "  npm unlink @quarkid/did-core @quarkid/did-registry @quarkid/agent"
echo "  npm install"
