# QuarkID App Flow: Keys, DIDs, VCs, and Prescription Management

This document details how the QuarkID-BSV application generates cryptographic keys, creates Decentralized Identifiers (DIDs), issues Verifiable Credentials (VCs), and manages the prescription workflow.

## Table of Contents

1. [Key Generation](#1-key-generation)
2. [DID Document Creation](#2-did-document-creation)
3. [Verifiable Credential Creation](#3-verifiable-credential-creation)
4. [Prescription Flow](#4-prescription-flow)
5. [Architecture Overview](#5-architecture-overview)

## 1. Key Generation

### Overview

The application generates cryptographic keys using multiple methods depending on the context:

- **ES256k keys** for DID authentication and signing
- **BBS+ keys** for Verifiable Credentials (optional)
- **X25519 keys** for DIDComm messaging
- **RSA keys** for additional authentication

### Key Generation Methods

#### A. KMS-Based Key Generation

**File:** `register/back/src/plugins/BsvOverlayRegistryAdapter.ts` (lines 67-77)

```typescript
// Generate a new key pair using the KMS
const keyResult = await this.kms.create(Suite.ES256k);
const publicKeyJWK = keyResult.publicKeyJWK;
const keyId = `did:bsv:${publicKeyJWK.x.substring(0, 16)}`;
```

**Process:**

1. Uses QuarkID KMS to create ES256k keys
2. Returns JWK format for DID document
3. Generates key ID based on public key

#### B. Agent Identity Key Generation

**File:** `Paquetes-NPMjs/packages/agent/core/src/models/agent-identity.ts` (lines 175-318)

```typescript
const updateKey = await this.kms.create(Suite.ES256k);
const recoveryKey = await this.kms.create(Suite.ES256k);

// Create different key types based on requirements
const didCommKeys = await Promise.all(
  params.keysToCreate
    .filter((x) => x.vmKey == VMKey.DIDComm)
    .map(async (x) => ({
      id: x.id!,
      pbk: await this.kms.create(Suite.DIDCommV2),
    }))
);

const bbsbls2020Keys = await Promise.all(
  params.keysToCreate
    .filter((x) => x.vmKey == VMKey.VC)
    .map(async (x) => ({
      id: x.id!,
      pbk: await this.kms.create(Suite.Bbsbls2020),
    }))
);
```

**Key Types Generated:**
- **ES256k**: Authentication and signing
- **DIDCommV2**: Secure messaging (X25519)
- **Bbsbls2020**: Verifiable Credentials (BBS+)
- **RsaSignature2018**: Additional authentication

## 2. DID Document Creation

### Overview

DID documents are created with verification methods, authentication, and assertion capabilities. The process varies based on the creation method.

### DID Creation Method

**File:** `register/back/src/plugins/BsvOverlayRegistry.ts` (lines 95-258)

```typescript
// Create the DID using serialNumber instead of txid:vout
const did = `did:bsv:${this.topic}:${serialNumber}`;

// Build PushDrop fields - serial number and DID document
const fields: Byte[][] = [
  serialNumberBytes  // Use the raw bytes for the PushDrop field
];

// Protocol ID for DID tokens - should match LARS topic
const protocolID: WalletProtocol = [0, 'tm did'];
const keyID: string = serialNumber;
const counterparty: string = 'self';

// Create the PushDrop locking script
const lock = await pushDropToken.lock(
  args.fields,
  args.protocolID,
  args.keyID,
  args.counterparty,
  args.forSelf,
  args.includeSignature,
  args.lockPosition
);
```

**Process:**
1. Generates unique serial number for DID
2. Creates PushDrop token with DID document
3. Uses BSV overlay for blockchain registration
4. Returns complete DID document with verification methods

#### C. Agent-Based DID Creation

**File:** `register/back/src/services/quarkIdAgentService.ts` (lines 267-314)

```typescript
async createDID(): Promise<string> {
  await this.ensureInitialized();
  
  try {
    console.log('[QuarkIdAgentService] Creating new DID...');
    
    // Create DID using the agent's identity module
    const did = await this.agent.identity.createNewDID({
      preventCredentialCreation: false,
      createDefaultKeys: true,
      didMethod: 'bsv'
    });
    
    console.log('[QuarkIdAgentService] DID created:', did.value);
    return did.value;
  } catch (error) {
    console.error('[QuarkIdAgentService] Error creating DID:', error);
    throw new Error(`Failed to create DID: ${error.message}`);
  }
}
```

**Process:**
1. Uses QuarkID Agent's identity module
2. Creates default keys (ES256k, DIDComm, BBS+)
3. Registers DID on BSV blockchain
4. Returns the created DID

## 3. Verifiable Credential Creation

### Overview

Verifiable Credentials are created using the QuarkID Agent's VC module with ES256k signing capabilities.

### VC Creation Process

#### A. QuarkID Agent Service VC Issuance

**File:** `register/back/src/services/quarkIdAgentService.ts` (lines 393-536)

```typescript
async issueVC(
  issuerDid: string,
  subjectDid: string,
  credentialType: string,
  claims: any,
  validFrom?: Date,
  validUntil?: Date
): Promise<VerifiableCredential> {
  
  // Ensure we have keys in the KMS
  await this.ensureKMSKeys();
  
  // CRITICAL: Force KMS replacement before VC signing
  (this.agent as any).kms = this.bsvKms;
  
  const credential: VerifiableCredential = {
    '@context': [
      'https://www.w3.org/2018/credentials/v1',
      'https://w3id.org/security/suites/jws-2020/v1'
    ],
    id: `urn:uuid:${this.generateUUID()}`,
    type: ['VerifiableCredential', credentialType],
    issuer: issuerDid,
    issuanceDate: issuanceDate,
    expirationDate: validUntil,
    credentialSubject: {
      id: subjectDid,
      ...claims
    }
  };

  // Sign the credential using Agent's VC module
  const signedVC = await this.agent.vc.signVC({
    credential,
    did: DID.from(issuerDid) as unknown as DID,
    purpose: 'assertionMethod' as any
  });

  return signedVC;
}
```

**Process:**
1. Creates credential structure with claims
2. Ensures KMS has proper keys
3. Signs credential using ES256k keys
4. Returns signed Verifiable Credential

#### B. Frontend VC Service

**File:** `register/front/src/services/vcService.ts` (lines 20-70)

```typescript
async createPrescriptionVC(
  formData: PrescriptionFormData,
  patient: Actor,
  doctor: Actor
): Promise<PrescriptionCredential> {
  
  const credentialSubject = {
    id: patient.did,
    patientInfo: {
      name: formData.patientName,
      identificationNumber: formData.patientId,
      age: formData.patientAge,
      insuranceProvider: formData.insuranceProvider
    },
    prescription: {
      id: prescriptionId,
      diagnosis: formData.diagnosis,
      medication: {
        name: formData.medicationName,
        dosage: formData.dosage,
        frequency: formData.frequency,
        duration: formData.duration
      },
      doctorId: doctor.did,
      prescribedDate: new Date().toISOString(),
      status: 'no dispensado'
    }
  };

  // Call backend to issue the VC
  const response = await fetch(`${API_BASE_URL}/vcs/issue`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      issuerDid: doctor.did,
      subjectDid: patient.did,
      credentialSubject,
      vcType: 'PrescriptionCredential',
      vcId
    })
  });
}
```

**Process:**
1. Prepares credential subject with prescription data
2. Sends request to backend for VC issuance
3. Returns signed prescription credential

## 4. Prescription Flow

### Overview

The prescription flow involves multiple actors (Doctor, Patient, Pharmacy) and creates a chain of Verifiable Credentials and BSV tokens.

### Prescription Flow Steps

#### Step 1: Doctor Creates Prescription

**File:** `register/back/src/services/prescriptionService.ts` (lines 121-217)

```typescript
async createPrescription(
  doctorDid: string,
  patientDid: string,
  prescriptionData: {
    patientName: string;
    patientId: string;
    patientAge: number;
    insuranceProvider?: string;
    diagnosis: string;
    medicationName: string;
    dosage: string;
    frequency: string;
    duration: string;
  }
): Promise<{
  prescriptionVC: PrescriptionVC;
  token: BSVPrescriptionToken;
  encryptedMessage: string;
}> {
  
  // Prepare the credential claims
  const credentialClaims = {
    patientInfo: {
      name: prescriptionData.patientName,
      identificationNumber: prescriptionData.patientId,
      age: prescriptionData.patientAge,
      insuranceProvider: prescriptionData.insuranceProvider
    },
    prescription: {
      id: prescriptionId,
      diagnosis: prescriptionData.diagnosis,
      medication: {
        name: prescriptionData.medicationName,
        dosage: prescriptionData.dosage,
        frequency: prescriptionData.frequency,
        duration: prescriptionData.duration
      },
      doctorId: doctorDid,
      prescribedDate: new Date().toISOString(),
      status: 'no dispensado'
    }
  };

  // Use QuarkID agent to issue and sign the VC
  const signedVC = await this.quarkIdAgentService.issueVC(
    doctorDid,           // issuerDid
    patientDid,          // subjectDid
    'PrescriptionCredential',  // credentialType
    credentialClaims     // claims
  );

  // Create BSV token with "no dispensado" status
  const token = await this.createPrescriptionToken(
    prescriptionId,
    patientDid,
    `${prescriptionData.medicationName} - ${prescriptionData.dosage}`
  );

  return {
    prescriptionVC,
    token,
    encryptedMessage
  };
}
```

**Process:**
1. Doctor creates prescription data
2. Issues Prescription VC using QuarkID Agent
3. Creates BSV token with "no dispensado" status
4. Encrypts message for patient transmission

#### Step 2: Pharmacy Creates Dispensation

**File:** `register/back/src/services/prescriptionService.ts` (lines 222-302)

```typescript
async createDispensation(
  pharmacyDid: string,
  pharmacistDid: string,
  prescriptionId: string,
  dispensationData: {
    batchNumber: string;
    expirationDate: string;
    manufacturer: string;
  },
  pharmacyPrivateKey: string
): Promise<{
  dispensationVC: DispensationVC;
  updatedToken: BSVPrescriptionToken;
  encryptedMessage: string;
}> {
  
  // Create Dispensation VC
  const dispensationVC: DispensationVC = {
    '@context': [
      'https://www.w3.org/2018/credentials/v1',
      'https://schema.org/',
      'https://quarkid.org/medical/v1'
    ],
    id: uuidv4(),
    type: ['VerifiableCredential', 'DispensationCredential'],
    issuer: pharmacyDid,
    issuanceDate: new Date().toISOString(),
    credentialSubject: {
      id: prescriptionVC.credentialSubject.id, // Patient's DID
      prescription: {
        id: prescriptionId,
        medication: {
          name: prescriptionVC.credentialSubject.prescription.medication.name,
          dosage: prescriptionVC.credentialSubject.prescription.medication.dosage,
          batchNumber: dispensationData.batchNumber,
          expirationDate: dispensationData.expirationDate,
          manufacturer: dispensationData.manufacturer
        },
        dispensedDate: new Date().toISOString(),
        pharmacyId: pharmacyDid,
        pharmacistId: pharmacistDid
      }
    }
  };

  // Add digital signature to VC
  dispensationVC.proof = await this.signVC(dispensationVC, pharmacyPrivateKey);

  // Transfer token to pharmacy but keep status as "no dispensado"
  const updatedToken = await this.transferTokenToPharmacy(
    prescriptionId,
    pharmacyDid,
    dispensationData.batchNumber
  );

  return {
    dispensationVC,
    updatedToken,
    encryptedMessage
  };
}
```

**Process:**
1. Pharmacy verifies prescription exists
2. Creates Dispensation VC with medication details
3. Signs VC with pharmacy's private key
4. Transfers BSV token to pharmacy
5. Encrypts message for patient

#### Step 3: Patient Confirmation

**File:** `register/back/src/services/prescriptionTokenService.ts` (lines 439-493)

```typescript
private async createConfirmationVC(token: PrescriptionToken, patientSignature: string): Promise<VerifiableCredential> {
  const vcData = {
    prescriptionReference: token.prescriptionVC.id,
    patient: { did: token.patientDid },
    confirmation: {
      confirmedDate: new Date().toISOString(),
      patientSignature: patientSignature,
      medicationReceived: token.prescriptionVC.credentialSubject.medicationName,
      quantity: token.prescriptionVC.credentialSubject.quantity
    }
  };

  return {
    '@context': [
      'https://www.w3.org/2018/credentials/v1',
      'https://schema.quarkid.com/confirmation/v1'
    ],
    id: `urn:confirmation:${crypto.randomUUID()}`,
    type: ['VerifiableCredential', 'ConfirmationCredential'],
    issuer: token.patientDid,
    issuanceDate: new Date().toISOString(),
    expirationDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    credentialSubject: vcData
  };
}
```

**Process:**
1. Patient receives medication
2. Creates Confirmation VC
3. Signs with patient's private key
4. Updates prescription status

### BSV Token Management

**File:** `register/back/src/services/prescriptionTokenService.ts` (lines 355-439)

```typescript
private async createTokenTransaction(prescriptionData: any, prescriptionVCId: string) {
  
  // Create the transaction using wallet client
  const createActionResult = await this.walletClient.createAction({
    description: 'Create prescription token with BSV overlay',
    outputs: [
      {
        satoshis: 1,
        lockingScript: lockingScript,
        outputDescription: 'Prescription PushDrop Token',
        basket: 'prescription-tokens',
        customInstructions: JSON.stringify({
          protocolID: protocolID,
          counterparty: counterparty,
          keyID: keyID,
          fields: fields,
          type: 'PushDrop',
          prescriptionVCData: prescriptionVCData
        })
      }
    ],
    options: {
      randomizeOutputs: false,
    },
    labels: ['prescription-token', 'create']
  });
  
  return {
    ...createActionResult,
    serialNumber,
    prescriptionVCData
  };
}
```

**Process:**
1. Creates PushDrop token with prescription data
2. Uses BSV overlay for blockchain registration
3. Links token to prescription VC
4. Enables token transfer between parties

## 5. Architecture Overview

### System Components

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Frontend      │───▶│   Backend        │───▶│   BSV Blockchain│
│   (React)       │    │   (Node.js)      │    │   (Overlay)     │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                              │
                              ▼
                       ┌─────────────────┐
                       │   QuarkID Agent │
                       │   (KMS, VC, DID)│
                       └─────────────────┘
```

### Key Services

1. **Actor Management**: Creates actors (Doctor, Patient, Pharmacy) with DIDs
2. **DID Registry**: Manages DID creation and resolution on BSV
3. **VC Service**: Issues and verifies Verifiable Credentials
4. **Prescription Service**: Manages prescription workflow
5. **Token Service**: Handles BSV token creation and transfer

### Data Flow

1. **Key Generation** → **DID Creation** → **Actor Registration**
2. **Prescription Creation** → **VC Issuance** → **Token Creation**
3. **Dispensation** → **VC Chain** → **Token Transfer**
4. **Confirmation** → **Status Update** → **Audit Trail**

### Security Features

- **Cryptographic Signing**: All VCs signed with ES256k keys
- **BSV Timestamping**: All transactions timestamped on blockchain
- **Encrypted Communication**: DWN for secure message transmission
- **Token-based Access**: BSV tokens control prescription access
- **Audit Trail**: Complete chain of custody on blockchain

### File Structure

```
register/
├── back/src/
│   ├── routes/
│   │   └── actorRoutes.ts          # Actor creation and DID generation
│   ├── services/
│   │   ├── quarkIdAgentService.ts  # QuarkID Agent integration
│   │   ├── prescriptionService.ts  # Prescription workflow
│   │   └── prescriptionTokenService.ts # BSV token management
│   └── plugins/
│       └── BsvOverlayRegistry.ts   # BSV DID registry
├── front/src/
│   └── services/
│       └── vcService.ts            # Frontend VC management
└── overlay/backend/
    └── src/
        ├── DIDTopicManager.ts      # DID validation
        └── VCTopicManager.ts       # VC validation
```

This architecture provides a complete decentralized identity and credential management system for healthcare prescriptions using BSV blockchain technology. 