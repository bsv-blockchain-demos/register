# BSV Transaction Flow for QuarkID Timestamping

This document explains how BSV transactions are created, signed, and broadcast to the blockchain for timestamping in the QuarkID-BSV system.

## Overview

The BSV transaction creation and broadcasting happens through **two different mechanisms** depending on the context:

1. **WalletClient.createAction()** - Transaction creation and signing only
2. **BSV Overlay Service** - Actual blockchain broadcasting and timestamping

## Transaction Flow Architecture

```mermaid


┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Application   │───▶│  WalletClient    │───▶│  BSV Overlay    │───▶│  BSV Blockchain │
│   (QuarkID)     │    │  createAction()  │    │  (LARS)         │    │  (Timestamping) │
└─────────────────┘    └──────────────────┘    └─────────────────┘    └─────────────────┘
                              │                        │
                              ▼                        ▼
                       ┌─────────────┐        ┌─────────────────┐
                       │ Transaction │        │ Topic Managers  │
                       │ Creation &  │        │ (DID/VC)        │
                       │ Signing     │        │ Validation      │
                       └─────────────┘        └─────────────────┘
```

## 1. Transaction Creation Phase

### WalletClient.createAction()

When you call `walletClient.createAction()` in your code, this **only creates and signs the transaction** but **does NOT broadcast it to the blockchain**.

**Key Files:**
- `register/back/src/plugins/BsvOverlayRegistry.ts` (lines 181-229)
- `register/front/src/services/walletService.ts` (lines 39-88)
- `register/back/src/services/prescriptionTokenService.ts` (lines 405-439)

**What it does:**
- Creates the transaction structure
- Signs it with the wallet's keys  
- Returns a `CreateActionResult` with the transaction data (BEEF format)
- **Does NOT broadcast to the blockchain**

**Example:**
```typescript
const createResult: CreateActionResult = await this.walletClient.createAction({
  description: 'Create DID transaction with BSV overlay',
  outputs: [
    {
      lockingScript: script.toHex(),
      satoshis: 1,
      outputDescription: 'DID Document',
      customInstructions: JSON.stringify({
        protocolID,
        counterparty,
        keyID
      })
    }
  ],
  options: {
    randomizeOutputs: false
  }
});
```

## 2. Blockchain Broadcasting Phase

The actual **blockchain broadcasting for timestamping** happens through the **BSV Overlay service** (LARS - Local Address Resolution Service).

### A. TopicBroadcaster.broadcast()

**Key Files:**
- `register/back/src/plugins/BsvOverlayRegistry.ts` (lines 506-540)

**Example:**
```typescript
const broadcaster = new TopicBroadcaster([topic])
const response = await broadcaster.broadcast(Transaction.fromBEEF(beef, txid))
```

### B. HTTP POST to Overlay Endpoint

**Key Files:**
- `Paquetes-NPMjs/packages/did/registry/src/services/BsvOverlayDidRegistryService.ts` (lines 275-330)

**Example:**
```typescript
const response = await fetch(`${this.config.overlayNodeEndpoint}/broadcast/${this.config.topic}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(broadcastPayload)
});
```

## 3. Complete Transaction Flow

### Step-by-Step Process:

1. **Transaction Creation**: `WalletClient.createAction()` creates and signs the transaction
2. **Overlay Processing**: The transaction is sent to the BSV Overlay service
3. **Topic Validation**: The overlay's `DIDTopicManager` or `VCTopicManager` validates the transaction
4. **Blockchain Broadcast**: The overlay service broadcasts the validated transaction to the BSV blockchain
5. **Indexing**: The overlay indexes the transaction for future lookups

### Detailed Flow:

```
1. Application Request
   ↓
2. WalletClient.createAction()
   ├── Creates transaction structure
   ├── Signs with wallet keys
   └── Returns CreateActionResult (BEEF format)
   ↓
3. BSV Overlay Service (LARS)
   ├── Receives transaction
   ├── Validates through TopicManager
   ├── Broadcasts to BSV network
   └── Indexes for resolution
   ↓
4. BSV Blockchain
   ├── Confirms transaction
   ├── Provides timestamp
   └── Permanent record
```

## 4. Key Components

### Topic Managers

**DID Topic Manager:**
- File: `register/overlay/backend/src/DIDTopicManager.ts`
- Validates DID transactions
- Ensures proper PushDrop format
- Admits valid outputs

**VC Topic Manager:**
- File: `register/overlay/backend/src/VCTopicManager.ts`
- Validates Verifiable Credential transactions
- Ensures proper token format
- Admits valid outputs

### Lookup Services

**DID Lookup Service:**
- File: `register/overlay/backend/src/DIDLookupServiceFactory.ts`
- Stores DID records
- Provides resolution capabilities
- Indexes by serial number

**VC Lookup Service:**
- File: `register/overlay/backend/src/VCLookupServiceFactory.ts`
- Stores VC records
- Provides verification capabilities
- Indexes by serial number

## 5. Transaction Types

### DID Creation Transactions

**Purpose:** Create new Decentralized Identifiers on BSV
**Format:** PushDrop tokens with DID document data
**Topic:** `tm_did`

### DID Update Transactions

**Purpose:** Update existing DIDs
**Format:** BRC-48 protocol with OP_UPDATE
**Topic:** `tm_did`

### VC Issuance Transactions

**Purpose:** Issue Verifiable Credentials
**Format:** PushDrop tokens with VC data
**Topic:** `tm_vc`

### Prescription Token Transactions

**Purpose:** Create prescription tokens
**Format:** PushDrop tokens with prescription data
**Topic:** Custom prescription topic

## 6. Error Handling

### Common Issues:

1. **Transaction Creation Failures**
   - Insufficient funds
   - Invalid script format
   - Signing errors

2. **Broadcast Failures**
   - Network connectivity issues
   - Invalid transaction format
   - Overlay service errors

3. **Validation Failures**
   - Topic manager rejection
   - Invalid token format
   - Missing required fields

### Debugging:

Enable debug logging in:
- `BsvOverlayRegistry.ts`
- `DIDTopicManager.ts`
- `VCTopicManager.ts`

## 7. Configuration

### Environment Variables:

```bash
# Overlay Service Configuration
OVERLAY_PROVIDER_URL=http://localhost:3000
WALLET_STORAGE_URL=http://localhost:3001
PLATFORM_FUNDING_KEY=your_private_key_here

# Topic Configuration
DID_TOPIC=tm_did
VC_TOPIC=tm_vc
```

### Network Configuration:

- **Mainnet:** Production BSV network
- **Testnet:** Development and testing
- **Regtest:** Local development

## 8. Best Practices

1. **Always validate transactions** before broadcasting
2. **Use proper error handling** for network failures
3. **Monitor overlay service health**
4. **Implement retry logic** for failed broadcasts
5. **Store transaction metadata** for future reference
6. **Use appropriate fee rates** for timely confirmation

## 9. Monitoring and Logging

### Key Log Points:

- Transaction creation success/failure
- Overlay service responses
- Blockchain confirmation status
- Topic manager validation results
- Lookup service indexing

### Metrics to Track:

- Transaction success rate
- Average confirmation time
- Overlay service availability
- Error rates by transaction type

## Conclusion

The BSV transaction flow in QuarkID is a two-phase process:

1. **Transaction Creation**: Handled by WalletClient.createAction()
2. **Blockchain Broadcasting**: Handled by BSV Overlay Service (LARS)

The overlay service acts as a middleware that ensures transactions are properly formatted, validated, and broadcast to the blockchain for permanent timestamping. This architecture provides:

- **Reliability**: Proper validation before broadcast
- **Scalability**: Distributed overlay network
- **Security**: Cryptographic verification
- **Persistence**: Permanent blockchain timestamping

For more information, refer to the individual component documentation and the BSV SDK documentation. 