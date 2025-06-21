#!/bin/bash

echo "🚨 BFG REPO CLEANER - SECURE CLEANUP 🚨"
echo "This method uses BFG Repo-Cleaner for safer and faster cleanup"
echo ""

# Check if BFG is installed
if ! command -v bfg &> /dev/null && ! [ -f "bfg.jar" ]; then
    echo "❌ BFG Repo-Cleaner not found!"
    echo ""
    echo "To install BFG:"
    echo "  macOS: brew install bfg"
    echo "  Or download: wget https://repo1.maven.org/maven2/com/madgag/bfg/1.14.0/bfg-1.14.0.jar"
    echo ""
    exit 1
fi

echo "⚠️  WARNING: This will rewrite git history!"
echo "⚠️  All collaborators will need to re-clone the repository after this"
echo ""
read -p "Are you sure you want to continue? (yes/no): " confirm
if [ "$confirm" != "yes" ]; then
    echo "Cleanup cancelled."
    exit 1
fi

# Create a backup
echo "📌 Creating backup..."
cp -r .git .git-backup

# Create a file with sensitive data patterns
echo "🔍 Creating patterns file for sensitive data..."
cat > sensitive-patterns.txt << 'EOF'
# Private keys (hex format)
[0-9a-fA-F]{64}

# Environment files
*.env
.env.*

# Specific sensitive files
front/src/context/wallets.ts

# API URLs with keys
VITE_DOCTOR_KEY=*
VITE_PATIENT_KEY=*
VITE_PHARMACY_KEY=*
VITE_PLATFORM_FUNDING_KEY=*
PLATFORM_FUNDING_KEY=*
EOF

# Remove specific files
echo "🗑️  Removing sensitive files..."
if command -v bfg &> /dev/null; then
    bfg --delete-files '*.env' --no-blob-protection
    bfg --delete-files 'wallets.ts' --no-blob-protection
else
    java -jar bfg.jar --delete-files '*.env' --no-blob-protection
    java -jar bfg.jar --delete-files 'wallets.ts' --no-blob-protection
fi

# Remove sensitive text patterns
echo "🔐 Removing sensitive text patterns..."
if command -v bfg &> /dev/null; then
    bfg --replace-text sensitive-patterns.txt --no-blob-protection
else
    java -jar bfg.jar --replace-text sensitive-patterns.txt --no-blob-protection
fi

# Clean up git history
echo "🧹 Cleaning up git repository..."
git reflog expire --expire=now --all
git gc --prune=now --aggressive

# Clean up temp files
rm sensitive-patterns.txt

echo ""
echo "✅ Repository cleaned with BFG!"
echo ""
echo "📝 Next steps:"
echo "1. Review the changes: git log --oneline"
echo "2. Check for any remaining sensitive data: git grep -i 'key\\|secret\\|password'"
echo "3. Force push to remote: git push origin --force --all"
echo "4. Force push tags: git push origin --force --tags"
echo ""
echo "⚠️  CRITICAL SECURITY STEPS:"
echo "1. IMMEDIATELY rotate these compromised keys:"
echo "   - Frontend: All VITE_ prefixed private keys and auth URLs"
echo "   - Backend: PLATFORM_FUNDING_KEY"
echo "   - MongoDB connection strings"
echo "2. Notify all collaborators to:"
echo "   - Delete their local copies"
echo "   - Re-clone from the cleaned repository"
echo "3. Check if the keys were used anywhere else and rotate those too"
echo "4. Monitor for any unauthorized usage of the compromised keys"
echo ""
echo "💾 Backup saved to .git-backup (delete after confirming success)"
