# Deep Dive Video Script: BSV DID Prescription System Architecture & Code

## Video Overview
**Duration**: ~15-20 minutes  
**Audience**: Developers wanting to understand the architecture and implementation  
**Goal**: Explain the technical architecture, code flow, and design decisions

---

## Introduction [0:00-0:45]

"Welcome to the deep technical dive into our BSV DID Prescription Management System.

In this video, we'll explore:
- The system architecture and how components interact
- DID creation and resolution using BSV overlays
- Verifiable Credential issuance and verification
- The complete prescription workflow from code perspective

This system showcases real-world usage of decentralized identity with blockchain-based credential management."

---

## Part 1: System Architecture [0:45-3:00]

"Let's start with the high-level architecture:

```
Frontend (React)          Backend (Express/QuarkID)          BSV Infrastructure
     │                              │                               │
     ├── API Calls ────────────────►│                               │
     │                              ├── QuarkID Agent               │
     │                              ├── BSV Wallet Client ─────────►│ BSV Blockchain
     │                              ├── Overlay Registry ───────────►│ LARS (Overlay)
     │                              └── MongoDB (Storage)           │ Wallet Storage
```

Key architectural decisions:
1. **Backend-centric cryptography**: All private key operations happen server-side
2. **QuarkID Agent**: Manages DIDs and VCs with pluggable registry adapters
3. **BSV Overlays**: DIDs stored on-chain using PushDrop pattern
4. **LARS**: Local overlay service for development (production would use Arc)"

---

## Part 2: DID Creation Flow [3:00-6:00]

"Let's trace through DID creation in the code:

### 1. API Endpoint (`didRoutes.ts`)
```typescript
router.post('/create', async (req, res) => {
  const { name } = req.body;
  const did = await quarkIdAgentService.createDID(name);
  res.json({ status: 'success', data: { did } });
});
```

### 2. QuarkID Agent Service (`QuarkIdAgentService.ts`)
```typescript
async createDID(name?: string): Promise<string> {
  // Agent uses BsvOverlayRegistryAdapter
  const result = await this.agent.identity.createNewIdentity({
    registry: 'bsvOverlay',
    name: name || 'BSV DID'
  });
  return result.did;
}
```

### 3. BSV Overlay Registry (`BsvOverlayRegistry.ts`)
```typescript
async createDID(document: DIDDocument): Promise<string> {
  // Create BSV transaction with DID document
  const result = await this.walletClient.createAction({
    outputs: [{
      script: buildDIDScript(document),  // PushDrop pattern
      satoshis: 1
    }]
  });
  
  // Submit to LARS for indexing
  await this.notifyOverlayProvider(result.txid, rawTx);
  
  return `did:bsv:${this.topic}:${result.txid}`;
}
```

The DID is now on-chain and indexed by LARS!"

---

## Part 3: Key Management Deep Dive [6:00-8:30]

"Key management is critical for security:

### BSV Wallet KMS (`BsvWalletKMS.ts`)
```typescript
class BsvWalletKMS implements IKMS {
  async create(params: CreateKeyPairParams): Promise<IKeyPair> {
    // Generate secp256k1 key pair
    const privateKey = bsv.PrivateKey.fromRandom();
    const publicKey = privateKey.toPublicKey();
    
    // Convert to JWK format for QuarkID
    return {
      publicKeyJWK: toJWK(publicKey),
      privateKeyHex: privateKey.toString('hex')
    };
  }
}
```

### Key Storage Architecture:
1. **Private keys**: Stored in MongoDB via QuarkID's secure storage
2. **Public keys**: Embedded in DID documents on-chain
3. **Key resolution**: Agent matches JWK from DID doc with stored keys

Important: Frontend never sees private keys!"

---

## Part 4: Verifiable Credential Flow [8:30-11:30]

"Now let's see how prescriptions become Verifiable Credentials:

### 1. Enhanced Prescription Creation
```typescript
// PrescriptionTokenService.ts
async createPrescriptionWithToken(data: PrescriptionData) {
  // Step 1: Create VC with prescription data
  const vc = await this.createPrescriptionVC(data);
  
  // Step 2: Sign VC with doctor's DID
  const signedVC = await quarkIdAgent.signVC(vc, data.doctorDid);
  
  // Step 3: Create BSV token associated with VC
  const token = await this.createBSVToken(signedVC);
  
  return { vc: signedVC, tokenId: token.txid };
}
```

### 2. VC Structure
```json
{
  "@context": ["https://www.w3.org/2018/credentials/v1"],
  "type": ["VerifiableCredential", "PrescriptionCredential"],
  "issuer": "did:bsv:tm_did:doctor123...",
  "credentialSubject": {
    "id": "did:bsv:tm_did:patient456...",
    "prescription": {
      "medication": "Amoxicillin",
      "dosage": "500mg",
      "frequency": "3x daily"
    }
  },
  "proof": {
    "type": "JsonWebSignature2020",
    "jws": "eyJhbGciOiJFUzI1NksifQ..."
  }
}
```"

---

## Part 5: BSV Token Integration [11:30-13:30]

"Each prescription is tokenized on BSV:

### Token Creation
```typescript
async createBSVToken(vc: VerifiableCredential): Promise<Token> {
  // Use BSV SDK to create STAS token
  const token = new OP_20({
    ticker: 'RX',
    supply: 1n,  // Non-fungible
    decimals: 0,
    metadata: {
      vcHash: hash(vc),
      prescriptionId: vc.id
    }
  });
  
  return await this.walletClient.createToken(token);
}
```

Benefits:
- **Ownership tracking**: Token holder has prescription rights
- **Transfer capability**: Patient can transfer to pharmacy
- **Audit trail**: All transfers recorded on-chain"

---

## Part 6: Frontend Architecture [13:30-15:30]

"The frontend is built with React and TypeScript:

### Key Services Refactored:
```typescript
// apiService.ts - No more private keys!
async createPrescription(data: PrescriptionData) {
  // Send to backend, no local signing
  return await fetch('/v1/enhanced/prescriptions', {
    method: 'POST',
    body: JSON.stringify(data)
  });
}
```

### State Management:
- React Context for user/actor state
- No local key storage
- Backend handles all crypto operations

### Component Structure:
```
App.tsx
├── ActorManagement (DID creation)
├── DoctorDashboard
│   └── PrescriptionForm
├── PharmacyDashboard
│   └── PrescriptionVerifier
└── PatientView
    └── PrescriptionList
```"

---

## Part 7: Error Handling & Edge Cases [15:30-17:00]

"Robust error handling throughout:

### DID Resolution Fallbacks:
```typescript
async resolveDID(did: string): Promise<DIDDocument> {
  try {
    // Try LARS first
    return await this.resolveFromLARS(did);
  } catch (error) {
    // Fallback to blockchain query
    return await this.resolveFromBlockchain(did);
  }
}
```

### Common Issues Handled:
1. **Insufficient funds**: Graceful error with funding instructions
2. **LARS offline**: Fallback to direct blockchain queries
3. **Invalid signatures**: Detailed verification failure messages
4. **Network timeouts**: Retry logic with exponential backoff"

---

## Part 8: Production Considerations [17:00-18:30]

"Moving to production requires:

### 1. Infrastructure Changes:
- Replace LARS with Arc (production overlay service)
- Use proper key management (HSM/Cloud KMS)
- Implement rate limiting and DDoS protection

### 2. Security Enhancements:
```typescript
// Add authentication middleware
app.use('/v1/dids', authenticate);
app.use('/v1/enhanced', authorize(['doctor', 'pharmacy']));

// Encrypt sensitive data at rest
const encryptedVC = await encrypt(vc, patientPublicKey);
```

### 3. Scalability:
- Implement caching for DID resolution
- Use message queues for async operations
- Consider microservices architecture"

---

## Part 9: Testing & Development Tools [18:30-19:30]

"The codebase includes comprehensive testing utilities:

### Test Scripts:
```bash
# Test DID creation and resolution
npm run test:did

# Test complete prescription flow
npm run test:prescription

# Debug specific issues
DEBUG=quarkid:* npm run dev
```

### Development Helpers:
- Mock UTXO generation for testing
- Debug endpoints for DID inspection
- Comprehensive logging throughout"

---

## Conclusion [19:30-20:00]

"We've covered the complete architecture:
- BSV DID creation using overlay protocols
- Secure key management with QuarkID
- Verifiable Credential issuance and verification
- Token-based prescription ownership
- Production-ready error handling

This system demonstrates real-world decentralized identity:
- No central authority controls identities
- Cryptographically verifiable prescriptions
- Immutable audit trail on blockchain
- Privacy-preserving credential sharing

Check the documentation for more details, and feel free to contribute!

Thanks for watching!"

---

## Visual Aids Needed

1. **Architecture diagrams** showing component interactions
2. **Sequence diagrams** for DID creation and VC issuance
3. **Code editor** showing key files and implementations
4. **Terminal output** demonstrating successful operations
5. **Browser DevTools** showing API calls and responses
6. **Blockchain explorer** showing created transactions
