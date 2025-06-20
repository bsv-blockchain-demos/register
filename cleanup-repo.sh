#!/bin/bash

echo "🧹 Starting repository cleanup..."

# Remove .env files from tracking
echo "📄 Removing .env files from tracking..."
git rm --cached back/.env 2>/dev/null || true
git rm --cached front/.env 2>/dev/null || true

# Remove node_modules directories from tracking
echo "📦 Removing node_modules from tracking..."
git rm -r --cached node_modules 2>/dev/null || true
git rm -r --cached back/node_modules 2>/dev/null || true
git rm -r --cached front/node_modules 2>/dev/null || true
git rm -r --cached overlay/node_modules 2>/dev/null || true
git rm -r --cached overlay/backend/node_modules 2>/dev/null || true

# Remove lock files from tracking
echo "🔒 Removing lock files from tracking..."
git rm --cached yarn.lock 2>/dev/null || true
git rm --cached back/yarn.lock 2>/dev/null || true
git rm --cached front/yarn.lock 2>/dev/null || true
git rm --cached back/package-lock.json 2>/dev/null || true
git rm --cached front/package-lock.json 2>/dev/null || true

# Remove local-data directories from tracking
echo "💾 Removing local data directories from tracking..."
git rm -r --cached overlay/local-data 2>/dev/null || true

# Remove any .DS_Store files
echo "🍎 Removing .DS_Store files..."
find . -name .DS_Store -print0 | xargs -0 git rm --cached --ignore-unmatch 2>/dev/null || true

echo "✅ Cleanup complete!"
echo ""
echo "⚠️  Important next steps:"
echo "1. Review the changes with: git status"
echo "2. Commit the cleanup: git commit -m 'Remove sensitive and unnecessary files from tracking'"
echo "3. Copy .env.example files to .env and add your actual keys"
echo "4. For backend: cp back/.env.example back/.env"
echo "5. For frontend: cp front/.env.example front/.env"
echo ""
echo "🔐 Security reminder: Never commit real API keys or private keys to the repository!"
