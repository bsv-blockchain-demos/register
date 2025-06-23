#!/bin/bash

# Special build script to handle circular dependencies in QuarkID packages
set -e

echo "🔄 Building QuarkID packages with circular dependency resolution..."

# Get absolute paths
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REGISTER_DIR="$(realpath "$SCRIPT_DIR")"
PARENT_DIR="$(dirname "$REGISTER_DIR")"
PAQUETES_REPO_DIR="$PARENT_DIR/Paquetes-NPMjs"
QUARKID_PACKAGES_DIR="$(realpath "$PAQUETES_REPO_DIR/packages")"

echo "📦 Creating stub declarations for circular dependencies..."

# Create stub declarations for @quarkid/did-core
cd "$QUARKID_PACKAGES_DIR/did/core"
mkdir -p dist
cat > dist/index.d.ts << 'EOF'
export interface DIDDocument {
  id: string;
  [key: string]: any;
}

export interface DIDCommMessage {
  id: string;
  type: string;
  thid?: string;
  from?: string;
  to?: string[];
  body?: any;
  attachments?: any[];
}

export abstract class Purpose {
  abstract validate(doc: any): boolean;
}

export enum VerificationRelationship {
  authentication = "authentication",
  assertionMethod = "assertionMethod",
  keyAgreement = "keyAgreement",
  capabilityInvocation = "capabilityInvocation",
  capabilityDelegation = "capabilityDelegation"
}

export interface VerificationMethod {
  id: string;
  type: string;
  controller: string;
  [key: string]: any;
}

export interface Service {
  id: string;
  type: string | string[];
  serviceEndpoint: string | Record<string, any>;
}
EOF

# Create stub declarations for @quarkid/vc-core
cd "$QUARKID_PACKAGES_DIR/vc/core"
mkdir -p dist
cat > dist/index.d.ts << 'EOF'
export interface VerifiableCredential {
  "@context": string | string[] | any;
  id?: string;
  type: string | string[];
  issuer: string | { id: string; [key: string]: any };
  issuanceDate: string;
  credentialSubject: any;
  proof?: any;
  [key: string]: any;
}

export interface VerifiablePresentation {
  "@context": string | string[] | any;
  type: string | string[];
  verifiableCredential?: VerifiableCredential | VerifiableCredential[];
  proof?: any;
  [key: string]: any;
}

export interface Proof {
  type: string;
  [key: string]: any;
}
EOF

# Create stub declarations for @quarkid/kms-core
cd "$QUARKID_PACKAGES_DIR/kms/core"
mkdir -p dist
cat > dist/index.d.ts << 'EOF'
export * from './models/kms';
export * from './models/suites/vc.suite';
export * from './models/suites/bbsbls2020.suite';
export * from './models/suites/selective-disclosure-zkp.suite';

// Stub some key interfaces
export interface Suite {
  derive(credential: any, revealDoc: any): Promise<any>;
  sign(credential: any): Promise<any>;
  verify(credential: any): Promise<boolean>;
}

export interface IKMS {
  [key: string]: any;
}
EOF

echo "✅ Stub declarations created"

echo ""
echo "📦 Now building each package..."

# Build did-core (no circular deps)
echo "Building @quarkid/did-core..."
cd "$QUARKID_PACKAGES_DIR/did/core"
npm run build || npx tsc --skipLibCheck

# Build kms-core and vc-core together (they depend on each other)
echo "Building @quarkid/kms-core..."
cd "$QUARKID_PACKAGES_DIR/kms/core"
npm link @quarkid/did-core
npm link @quarkid/vc-core
npx tsc --skipLibCheck

echo "Building @quarkid/vc-core..."
cd "$QUARKID_PACKAGES_DIR/vc/core"
npm link @quarkid/did-core
npm link @quarkid/kms-core
npx tsc --skipLibCheck

# Build kms-client
echo "Building @quarkid/kms-client..."
cd "$QUARKID_PACKAGES_DIR/kms/client"
npm link @quarkid/did-core
npm link @quarkid/kms-core
npm link @quarkid/vc-core
npm run build || npx tsc --skipLibCheck

# Build did-registry
echo "Building @quarkid/did-registry..."
cd "$QUARKID_PACKAGES_DIR/did/registry"
npm link @quarkid/did-core
npm link @quarkid/kms-core
npm link @quarkid/kms-client
npm link @quarkid/vc-core
npm run build || npx tsc --skipLibCheck

# Build agent
echo "Building @quarkid/agent..."
cd "$QUARKID_PACKAGES_DIR/agent/core"

# Apply ECDSA support modifications
echo "📝 Applying ECDSA support modifications to @quarkid/agent..."
if [ -f "src/vc/vc.ts" ]; then
  # Restore from backup if it exists
  if [ -f "src/vc/vc.ts.backup" ]; then
    cp src/vc/vc.ts.backup src/vc/vc.ts
    echo "Restored from backup"
  else
    # Create backup
    cp src/vc/vc.ts src/vc/vc.ts.backup
  fi
  
  # Make the modifications more carefully
  # 1. First, add EcdsaSecp256k1VerificationKey2019 to the filter
  sed -i '' 's/x\.type == "Bls12381G1Key2020"/x.type == "Bls12381G1Key2020" || x.type == "EcdsaSecp256k1VerificationKey2019"/' src/vc/vc.ts
  
  echo "✅ ECDSA support modifications applied"
else
  echo "⚠️  Warning: src/vc/vc.ts not found"
fi

npm link @quarkid/did-core
npm link @quarkid/kms-core
npm link @quarkid/kms-client
npm link @quarkid/vc-core
npm link @quarkid/did-registry
npm run build || npx tsc --skipLibCheck

echo ""
echo "✅ All packages built successfully!"

echo ""
echo "📦 Linking packages to register app..."
cd "$REGISTER_DIR/back"
npm link @quarkid/kms-core
npm link @quarkid/kms-client
npm link @quarkid/vc-core
npm link @quarkid/did-core
npm link @quarkid/did-registry
npm link @quarkid/agent

echo ""
echo "🎉 Build complete! All packages are linked and ready."
