# BSV DID Integration for QuarkID Backend

## Overview

This document provides comprehensive documentation for the Bitcoin SV (BSV) overlay DID method integration within the QuarkID backend. The BSV DID method allows for creating, updating, and resolving Decentralized Identifiers (DIDs) using the BSV blockchain overlay protocol with the QuarkID Agent framework.

## Table of Contents

- [Architecture](#architecture)
- [DID Format](#did-format)
- [API Endpoints](#api-endpoints)
- [Configuration](#configuration)
- [Installation & Setup](#installation--setup)
- [Usage Examples](#usage-examples)
- [Error Handling](#error-handling)
- [Production Deployment](#production-deployment)
- [Troubleshooting](#troubleshooting)

## Architecture

### BSV DID Method Overview

The BSV overlay DID method integrates with the QuarkID Agent to store DID documents on the Bitcoin SV blockchain using overlay protocols:

- **DID Format**: `did:bsv:<topic>:<serialNumber>`
- **Storage**: DID documents are stored using BSV overlay transactions with PushDrop pattern
- **Resolution**: LARS (Local Authenticated Resolver Service) acts as a local development environment for a BSV blockchain overlay, indexing and serving DID documents
- **Key Management**: Integrated with BSV Wallet KMS through QuarkID Agent
- **Transaction Flow**: BSV Wallet posts transactions both to the blockchain and to LARS for indexing

### System Components

```text
┌─────────────────┐    ┌─────────────────┐    
│   Express API   │────│ QuarkIdAgent    │    
│   (Routes)      │    │   Service       │    
└─────────────────┘    └─────────────────┘    
         │                       │             
         │              ┌─────────────────┐
         └──────────────│  BSV Wallet     │─────┐
                        │  Client/KMS     │     │
                        └─────────────────┘     │
                                │               │
                                │               │
                        ┌───────▼────────┐      │
                        │ Wallet Storage │      │
                        │ (Babbage)      │      │
                        └─────────────────┘      │
                                                │
                        ┌─────────────────┐     │
                        │ LARS (BSV       │◄────┘
                        │ Overlay Service)│
                        └────────┬────────┘
                                 │
                        ┌────────▼────────┐
                        │ BSV Blockchain  │
                        └─────────────────┘
```

### Key Services

1. **QuarkIdAgentService**: Main service orchestrating DID operations through the QuarkID Agent
2. **BsvOverlayRegistry**: Handles BSV-specific DID creation and updates
3. **BsvOverlayResolver**: Resolves DIDs from LARS
4. **BsvWalletKMS**: Key Management Service integrating BSV wallet with QuarkID Agent
5. **LARS**: The BSV blockchain overlay service that:
   - Receives DID transactions from the BSV wallet
   - Indexes DID documents from blockchain transactions
   - Provides lookup/resolution services for DIDs
6. **Wallet Storage (Babbage)**: Remote storage service where the wallet maintains copies of transactions

### Transaction Flow

1. **DID Creation**: 
   - QuarkID Agent creates DID document
   - BSV Wallet creates and signs transaction
   - Transaction posted to BSV blockchain
   - Transaction also submitted to LARS for indexing
   - Wallet stores copy in Babbage storage

2. **DID Resolution**:
   - Resolution request sent to LARS
   - LARS returns indexed DID document
   - Falls back to blockchain lookup if not indexed

## DID Format

BSV DIDs follow this format:

```text
did:bsv:<topic>:<serialNumber>
```

Where:

- `topic`: The overlay topic (e.g., `tm_did` for DIDs, `tm_vc` for VCs)
- `serialNumber`: Unique identifier derived from the BSV transaction

Example:

```text
did:bsv:tm_did:fc54492241f95d82628f7e5bc22e5a36ddc1d558039f8ab1545d048fb18eaefa
```

## API Endpoints

All DID operations are exposed through RESTful endpoints under `/v1/dids/`:

### Create DID

**POST** `/v1/dids/create`

Creates a new DID on the BSV blockchain.

**Request:**

```json
{
  "name": "My DID"  // Optional
}
```

**Response:**

```json
{
  "status": "success",
  "data": {
    "did": "did:bsv:tm_did:fc54492241f95d82628f7e5bc22e5a36ddc1d558039f8ab1545d048fb18eaefa"
  }
}
```

### Update DID

**POST** `/v1/dids/update`

Updates an existing DID by adding verification methods or services.

**Request:**

```json
{
  "did": "did:bsv:tm_did:existing_serial_number",
  "verificationMethods": [...],  // Optional
  "services": [...]              // Optional
}
```

**Response:**

```json
{
  "status": "success",
  "data": {
    "didDocument": {
      "@context": ["https://www.w3.org/ns/did/v1"],
      "id": "did:bsv:tm_did:new_serial_number",
      "verificationMethod": [...],
      "service": [...]
    }
  }
}
```

### Resolve DID

**GET** `/v1/dids/:did`

Retrieves a DID document by resolving the DID identifier.

**Example:**

```text
GET /v1/dids/did%3Absv%3Atm_did%3Afc54492241f95d82628f7e5bc22e5a36ddc1d558039f8ab1545d048fb18eaefa
```

**Response:**

```json
{
  "status": "success",
  "data": {
    "didDocument": {
      "@context": ["https://www.w3.org/ns/did/v1"],
      "id": "did:bsv:tm_did:fc54492241f95d82628f7e5bc22e5a36ddc1d558039f8ab1545d048fb18eaefa",
      "verificationMethod": [{
        "id": "did:bsv:tm_did:fc54492241f95d82628f7e5bc22e5a36ddc1d558039f8ab1545d048fb18eaefa#key-1",
        "type": "JsonWebKey2020",
        "controller": "did:bsv:tm_did:fc54492241f95d82628f7e5bc22e5a36ddc1d558039f8ab1545d048fb18eaefa",
        "publicKeyJwk": {
          "kty": "EC",
          "crv": "secp256k1",
          "x": "...",
          "y": "..."
        }
      }],
      "authentication": ["#key-1"],
      "assertionMethod": ["#key-1"]
    }
  }
}
```

## Configuration

### Environment Variables

Create a `.env` file in the backend directory:

```env
# BSV DID Configuration
DID_TOPIC=your_topic_identifier
OVERLAY_PROVIDER_URL=https://your-overlay-node.com
DEFAULT_FUNDING_PUBLIC_KEY_HEX=your_64_character_hex_public_key # Optional

# MongoDB Configuration (optional)
MONGO_URI=mongodb://localhost:27017
APP_DB_NAME=quarkid_dids

# VC Configuration  
VC_TOPIC=tm_vc                     # Topic for Verifiable Credentials
VC_TOPIC_SERVICE=ls_vc             # Service topic for VC lookups

# Overlay Provider URL
OVERLAY_PROVIDER_URL=http://localhost:8080   # LARS overlay service endpoint

# Server Configuration
PORT=3000

# Wallet Storage URL
WALLET_STORAGE_URL=https://storage.babbage.systems

# Development Configuration
MOCK_UTXOS=false
NODE_ENV=development
```

### Required Services

1. **MongoDB**: For storing DID documents and agent data locally
2. **LARS (BSV Overlay Service)**: For indexing and resolving BSV overlay data
3. **BSV Wallet**: With sufficient funds for transaction fees
4. **Babbage Storage**: Remote storage service for wallet transaction copies

## Installation & Setup

### Prerequisites

- Node.js v18+
- MongoDB 4.4+
- LARS overlay service running
- BSV wallet with funds

### Installation Steps

1. Clone the repository and install dependencies:

```bash
cd back
npm install
```

2. Configure environment variables:

```bash
cp .env.example .env
# Edit .env with your configuration
```

3. Start MongoDB:

```bash
# Using Docker
docker run -d -p 27017:27017 --name mongodb mongo:latest

# Or using system service
sudo systemctl start mongodb
```

4. Start LARS overlay service:

```bash
cd ../overlay
docker-compose up -d
```

5. Start the backend server:

```bash
npm run dev
```

## Usage Examples

### Creating a DID

```javascript
// Using fetch
const response = await fetch('http://localhost:3000/v1/dids/create', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    name: 'Test DID'
  })
});

const result = await response.json();
console.log('Created DID:', result.data.did);
```

### Resolving a DID

```javascript
const did = 'did:bsv:tm_did:fc54492241f95d82628f7e5bc22e5a36ddc1d558039f8ab1545d048fb18eaefa';
const encodedDid = encodeURIComponent(did);

const response = await fetch(`http://localhost:3000/v1/dids/${encodedDid}`);
const result = await response.json();
console.log('DID Document:', result.data.didDocument);
```

## Error Handling

### Common Errors

| Error | Description | Solution |
|-------|-------------|----------|
| `QuarkIdAgentService not initialized` | Service not properly started | Check MongoDB connection and environment variables |
| `Insufficient funds` | Wallet lacks BSV for fees | Fund the wallet with BSV |
| `DID not found` | DID doesn't exist or not indexed in LARS | Verify DID exists and LARS has indexed it |
| `Invalid DID format` | Malformed DID string | Check DID follows `did:bsv:<topic>:<serialNumber>` format |

### Error Response Format

```json
{
  "status": "error",
  "description": "Error message describing what went wrong"
}
```

## Production Deployment

### Security Considerations

1. **Private Keys**:
   - Never expose private keys in logs or responses
   - Use secure key management services in production
   - Rotate keys regularly

2. **Environment Variables**:
   - Use secrets management (AWS Secrets Manager, Vault, etc.)
   - Never commit `.env` files to version control

3. **API Security**:
   - Implement rate limiting
   - Use API authentication for production endpoints
   - Enable CORS only for trusted domains

### Deployment Checklist

- [ ] Environment variables configured securely
- [ ] MongoDB secured with authentication
- [ ] LARS overlay service accessible and properly configured
- [ ] BSV wallet funded and secured
- [ ] SSL/TLS certificates configured
- [ ] Monitoring and logging enabled
- [ ] Backup procedures in place

## Troubleshooting

### Common Issues

#### 1. "QuarkIdAgentService not initialized"

**Symptom**: API returns 500 error
**Solution**:

- Check MongoDB is running and accessible
- Verify all required environment variables are set
- Check server logs for initialization errors

#### 2. "Insufficient funds in the available inputs"

**Symptom**: DID creation fails with funding error
**Solution**:

- Ensure wallet has sufficient BSV (minimum 1001 satoshis per operation)
- Check wallet client is properly initialized

#### 3. "Cannot resolve DID"

**Symptom**: DID resolution returns null or error
**Solution**:

- Verify LARS overlay service is running at OVERLAY_PROVIDER_URL
- Check that the DID was successfully submitted to LARS
- Ensure LARS has indexed the transaction
- Check network connectivity between services

#### 4. "Invalid topic configuration"

**Symptom**: LARS rejects DID submissions
**Solution**:

- Ensure DID_TOPIC matches LARS configured topics (e.g., `tm_did`)
- Verify LARS supports the topic by checking its configuration

### Debug Mode

Enable debug logging:

```bash
DEBUG=quarkid:* npm run dev
```

### Health Checks

Monitor service health:

- `GET /` - API status and service connections
- `GET /health` - Detailed health status

---

## Support

For additional support:

1. Check server logs for detailed error messages
2. Verify all services are running (MongoDB, LARS, BSV wallet)
3. Review the main QuarkID documentation
4. Consult BSV SDK documentation for wallet-specific issues
