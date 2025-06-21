#!/bin/bash

# Script to unlink local QuarkID packages and restore npm registry versions
# Use this when ready to deploy or switch back to published packages

set -e

echo "🔗 Unlinking QuarkID packages..."

REGISTER_DIR="./Paquetes-NPMjs/register"

cd "$REGISTER_DIR/back"

echo "📦 Unlinking packages from register app..."
npm unlink @quarkid/did-core @quarkid/did-registry @quarkid/agent

echo "📦 Reinstalling packages from npm registry..."
npm install

echo ""
echo "🎉 All QuarkID packages unlinked successfully!"
echo "Register app is now using published npm packages."
