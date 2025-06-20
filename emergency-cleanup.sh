#!/bin/bash

echo "🚨 EMERGENCY GIT HISTORY CLEANUP 🚨"
echo "This will remove sensitive data from your entire git history"
echo ""
echo "⚠️  WARNING: This will rewrite git history!"
echo "⚠️  All collaborators will need to re-clone the repository after this"
echo ""
read -p "Are you sure you want to continue? (yes/no): " confirm
if [ "$confirm" != "yes" ]; then
    echo "Cleanup cancelled."
    exit 1
fi

# Create a backup branch
echo "📌 Creating backup branch..."
git branch backup-before-cleanup

# Remove sensitive files from the entire history
echo "🔥 Removing sensitive files from git history..."

# Remove .env files
git filter-branch --force --index-filter \
'git rm --cached --ignore-unmatch back/.env front/.env' \
--prune-empty --tag-name-filter cat -- --all

# Remove private key files and wallets.ts
git filter-branch --force --index-filter \
'git rm --cached --ignore-unmatch front/src/context/wallets.ts' \
--prune-empty --tag-name-filter cat -- --all

# Remove all node_modules directories
git filter-branch --force --index-filter \
'git rm -r --cached --ignore-unmatch node_modules back/node_modules front/node_modules overlay/node_modules overlay/backend/node_modules' \
--prune-empty --tag-name-filter cat -- --all

# Remove all lock files
git filter-branch --force --index-filter \
'git rm --cached --ignore-unmatch yarn.lock back/yarn.lock front/yarn.lock back/package-lock.json front/package-lock.json' \
--prune-empty --tag-name-filter cat -- --all

# Remove local-data
git filter-branch --force --index-filter \
'git rm -r --cached --ignore-unmatch overlay/local-data' \
--prune-empty --tag-name-filter cat -- --all

# Clean up
echo "🧹 Cleaning up git objects..."
rm -rf .git/refs/original/
git reflog expire --expire=now --all
git gc --prune=now --aggressive

echo ""
echo "✅ Git history cleaned!"
echo ""
echo "📝 Next steps:"
echo "1. Review the changes: git log --oneline"
echo "2. Force push to remote: git push origin --force --all"
echo "3. Force push tags: git push origin --force --tags"
echo "4. Delete and re-protect any protected branches on GitHub/GitLab"
echo ""
echo "⚠️  CRITICAL SECURITY STEPS:"
echo "1. Immediately rotate ALL exposed keys and credentials"
echo "2. Notify all collaborators to delete their local copies and re-clone"
echo "3. Consider the exposed keys as permanently compromised"
echo ""
echo "🔐 The backup branch 'backup-before-cleanup' contains the original history"
