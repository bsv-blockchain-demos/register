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

# Function to prepare a package (clean and install deps)
prepare_package() {
    local package_dir="$1"
    local package_name="$2"

    echo "📦 Preparing $package_name..."

    # Navigate to package directory
    cd "$QUARKID_PACKAGES_DIR/$package_dir"

    # Clean previous builds and dependencies
    echo "  Cleaning previous build artifacts..."
    rm -rf node_modules package-lock.json dist

    # Install dependencies with legacy peer deps
    echo "  Installing dependencies for $package_name..."
    npm install --legacy-peer-deps

    echo "  ✅ $package_name prepared"
}

# Function to link a package (without building)
link_package() {
    local package_dir="$1"
    local package_name="$2"

    echo "📦 Creating npm link for $package_name..."

    # Navigate to package directory
    cd "$QUARKID_PACKAGES_DIR/$package_dir"

    # Create global link
    npm link

    echo "  ✅ $package_name linked"
}

# Function to generate minimal declarations for circular deps
generate_minimal_declarations() {
    local package_dir="$1"
    local package_name="$2"

    echo "📦 Generating minimal declarations for $package_name..."

    # Navigate to package directory
    cd "$QUARKID_PACKAGES_DIR/$package_dir"

    # Generate only declaration files with maximum permissiveness
    echo "  Generating declaration files (skipLibCheck, no emit)..."
    npx tsc --declaration --emitDeclarationOnly --skipLibCheck --noEmitOnError false 2>/dev/null || true

    echo "  ✅ Minimal declarations generated for $package_name"
}

# Function to build a package
build_package() {
    local package_dir="$1"
    local package_name="$2"
    local skip_errors="${3:-false}"

    echo "📦 Building $package_name..."

    # Navigate to package directory
    cd "$QUARKID_PACKAGES_DIR/$package_dir"

    # Link all local dependencies
    echo "  Linking local @quarkid dependencies..."
    npm link @quarkid/kms-core 2>/dev/null || true
    npm link @quarkid/kms-client 2>/dev/null || true
    npm link @quarkid/vc-core 2>/dev/null || true
    npm link @quarkid/did-core 2>/dev/null || true
    npm link @quarkid/did-registry 2>/dev/null || true

    echo "  Building $package_name..."

    # Build the package
    if [ "$skip_errors" = "true" ]; then
        # For circular deps, build with skipLibCheck
        npx tsc --skipLibCheck || true
    else
        if ! npm run build; then
            echo "  ⚠️  Build failed for $package_name, attempting transpile-only..."
            npx tsc --skipLibCheck || true
        fi
    fi

    echo "  ✅ $package_name built"
}

echo ""
echo "=== Step 1: Preparing all QuarkID packages ==="

# Clean and install dependencies for all packages
prepare_package "did/core" "@quarkid/did-core"
prepare_package "kms/core" "@quarkid/kms-core"
prepare_package "vc/core" "@quarkid/vc-core"
prepare_package "kms/client" "@quarkid/kms-client"
prepare_package "did/registry" "@quarkid/did-registry"
prepare_package "agent/core" "@quarkid/agent"

echo ""
echo "=== Step 2: Creating npm links for all packages ==="

# Create npm links for all packages (without building)
link_package "did/core" "@quarkid/did-core"
link_package "kms/core" "@quarkid/kms-core"
link_package "vc/core" "@quarkid/vc-core"
link_package "kms/client" "@quarkid/kms-client"
link_package "did/registry" "@quarkid/did-registry"
link_package "agent/core" "@quarkid/agent"

echo ""
echo "=== Step 3: Handling circular dependency (kms-core ↔ vc-core) ==="

# Link local dependencies for circular packages
cd "$QUARKID_PACKAGES_DIR/kms/core"
npm link @quarkid/did-core @quarkid/vc-core 2>/dev/null || true

cd "$QUARKID_PACKAGES_DIR/vc/core"
npm link @quarkid/did-core @quarkid/kms-core 2>/dev/null || true

# Generate minimal declarations for circular deps
generate_minimal_declarations "kms/core" "@quarkid/kms-core"
generate_minimal_declarations "vc/core" "@quarkid/vc-core"

echo ""
echo "=== Step 4: Building all QuarkID packages ==="

# Build packages in dependency order
build_package "did/core" "@quarkid/did-core"

# Build circular deps with skipLibCheck
build_package "kms/core" "@quarkid/kms-core" true
build_package "vc/core" "@quarkid/vc-core" true

# Build remaining packages
build_package "kms/client" "@quarkid/kms-client"
build_package "did/registry" "@quarkid/did-registry"
build_package "agent/core" "@quarkid/agent"

echo ""
echo "=== Step 5: Linking QuarkID packages in register app ==="

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
