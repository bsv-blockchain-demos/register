#!/bin/bash

# Script to switch from local file: dependencies to published npm packages
# Use this when you want to test with the published versions

set -e

echo "🔄 Switching to published QuarkID packages..."

REGISTER_DIR="$(pwd)"

# Backup current package.json files
echo "💾 Backing up current package.json files..."
cp back/package.json back/package.json.local-backup
cp front/package.json front/package.json.local-backup

# Update backend package.json to use published versions
echo "📝 Updating backend package.json..."
cat > back/package.json << 'EOF'
{
  "name": "register",
  "version": "0.0.0",
  "private": true,
  "scripts": {
    "build": "tsc",
    "start": "node dist/app.js",
    "dev": "tsx src/app.ts"
  },
  "dependencies": {
    "@bsv/auth-express-middleware": "^1.1.2",
    "@bsv/payment-express-middleware": "^1.0.6",
    "@bsv/sdk": "^1.5.2",
    "@bsv/wallet-toolbox": "^1.4.4",
    "@bsv/wallet-toolbox-client": "^1.3.30",
    "@quarkid/agent": "^1.0.0",
    "@quarkid/did-core": "^1.0.0",
    "@quarkid/did-registry": "^1.0.0",
    "@quarkid/did-resolver": "^1.0.0",
    "@quarkid/dwn-client": "^1.0.0",
    "@quarkid/dwn-scheduler": "^1.0.0",
    "@quarkid/kms-client": "^1.0.0",
    "@quarkid/kms-core": "^1.0.0",
    "@quarkid/kms-suite-bbsbls2020": "^1.0.0",
    "@quarkid/kms-suite-didcomm": "^1.0.0",
    "@quarkid/kms-suite-didcomm-v2": "^1.0.0",
    "@quarkid/kms-suite-es256k": "^1.0.0",
    "@quarkid/kms-suite-jsonld": "^1.0.0",
    "@quarkid/kms-suite-rsa-signature-2018": "^1.0.0",
    "@quarkid/kms-storage-vault": "^1.0.0",
    "@quarkid/modena-sdk": "^1.0.0",
    "@quarkid/status-list-agent-plugin": "^1.0.0",
    "@quarkid/vc-core": "^1.0.0",
    "@quarkid/vc-verifier": "^1.0.0",
    "@quarkid/waci": "^1.0.0",
    "cors": "^2.8.5",
    "dotenv": "^16.5.0",
    "express": "^5.1.0",
    "mongodb": "^6.16.0",
    "node-fetch": "^2.7.0",
    "semver": "^7.7.2",
    "typescript": "^5.8.3",
    "uuid": "^11.1.0"
  },
  "devDependencies": {
    "@types/node": "^22.15.23",
    "@types/node-fetch": "^2.6.11",
    "tsx": "^4.19.4"
  }
}
EOF

# Update frontend package.json to use published versions
echo "📝 Updating frontend package.json..."
cat > front/package.json << 'EOF'
{
  "name": "did-creator",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "lint": "eslint .",
    "preview": "vite preview"
  },
  "dependencies": {
    "@bsv/sdk": "^1.5.3",
    "@bsv/wallet-toolbox-client": "^1.3.31",
    "@quarkid/did-core": "^1.0.0",
    "@quarkid/did-registry": "^1.0.0",
    "@radix-ui/react-label": "^2.1.7",
    "@radix-ui/react-select": "^2.2.5",
    "@radix-ui/react-slot": "^1.2.3",
    "@tailwindcss/postcss": "^4.1.8",
    "@tailwindcss/vite": "^4.1.8",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "crypto-js": "^4.2.0",
    "html5-qrcode": "^2.3.8",
    "jsqr": "^1.4.0",
    "lucide-react": "^0.513.0",
    "qrcode": "^1.5.3",
    "qrcode-generator": "^1.4.4",
    "react": "^19.1.0",
    "react-dom": "^19.1.0",
    "react-icons": "^5.5.0",
    "react-router-dom": "^6.28.0",
    "shadcn": "^2.6.1",
    "tailwind-merge": "^3.3.0",
    "tailwindcss-animate": "^1.0.7",
    "uuid": "^10.0.0"
  },
  "devDependencies": {
    "@eslint/js": "^9.25.0",
    "@types/crypto-js": "^4.2.2",
    "@types/node": "^20.14.2",
    "@types/qrcode": "^1.5.5",
    "@types/react": "^19.1.2",
    "@types/react-dom": "^19.1.2",
    "@types/uuid": "^10.0.0",
    "@vitejs/plugin-react": "^4.4.1",
    "autoprefixer": "^10.4.21",
    "eslint": "^9.25.0",
    "eslint-plugin-react-hooks": "^5.2.0",
    "eslint-plugin-react-refresh": "^0.4.19",
    "globals": "^16.0.0",
    "postcss": "^8.5.4",
    "tailwindcss": "^4.1.8",
    "typescript": "~5.8.3",
    "typescript-eslint": "^8.30.1",
    "vite": "^6.3.5"
  }
}
EOF

# Clean and reinstall dependencies
echo "🧹 Cleaning existing node_modules..."
rm -rf back/node_modules back/package-lock.json
rm -rf front/node_modules front/package-lock.json

echo "📦 Installing published packages in backend..."
cd back
npm install
cd ..

echo "📦 Installing published packages in frontend..."
cd front
npm install
cd ..

echo ""
echo "✅ Successfully switched to published QuarkID packages!"
echo ""
echo "📝 Notes:"
echo "  - All QuarkID packages now use published versions from npm"
echo "  - Local development changes in Paquetes-NPMjs will NOT be reflected"
echo "  - To switch back to local development, run: ./setup-local-development.sh"
echo "  - Backup files saved as: package.json.local-backup"
echo ""
echo "🔄 To restore local development setup:"
echo "  ./restore-local-development.sh" 