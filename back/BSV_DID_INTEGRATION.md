# BSV DID Integration for QuarkID Backend

## Overview

This document provides comprehensive documentation for the Bitcoin SV (BSV) overlay DID method integration within the QuarkID backend. The BSV DID method allows for creating, updating, and resolving Decentralized Identifiers (DIDs) directly on the Bitcoin SV blockchain using OP_RETURN transactions.

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

The BSV overlay DID method stores DID documents directly on the Bitcoin SV blockchain using a custom overlay protocol:

- **DID Format**: `did:bsv:<topic>:<txid>:<vout>`
- **Storage**: DID documents are embedded in `OP_RETURN` outputs of BSV transactions
- **Identifier**: A unique P2PKH output in the same transaction serves as the on-chain identifier
- **Resolution**: Custom overlay node service resolves DIDs from blockchain data

### System Components

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Express API   │────│  BsvDidService  │────│ BSV Blockchain  │
│   (Routes)      │    │                 │    │   (OP_RETURN)   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │              ┌─────────────────┐              │
         └──────────────│ WalletClient    │──────────────┘
                        │ (UTXO/Signing)  │
                        └─────────────────┘
```

### Key Classes

- **`BsvDidService`**: Main service class handling DID operations
- **`BsvOverlayDidRegistryService`**: Core BSV overlay protocol implementation
- **`WalletClient`**: BSV SDK wallet for transaction signing and UTXO management
- **`createDidRoutes`**: Express router factory for DID endpoints

## DID Format

BSV DIDs follow this format:
```
did:bsv:<topic>:<txid>:<vout>
```

### Components
- **`topic`**: Overlay topic identifier (configured via `DID_TOPIC`)
- **`txid`**: Bitcoin transaction hash containing the DID
- **`vout`**: Output index of the P2PKH identifier output

### Example
```
did:bsv:quarkid-test:a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456:1
```

## API Endpoints

### Base URL
All BSV DID endpoints are available at: `/v1/dids/`

### Authentication
All endpoints require authentication via the `@bsv/auth-express-middleware`.

### Endpoints

#### 1. Create DID
Creates a new BSV DID by broadcasting a transaction to the BSV network.

**Endpoint:** `POST /v1/dids/create`

**Request Body:**
```json
{
  "didDocument": {
    "@context": ["https://www.w3.org/ns/did/v1"],
    "id": "",
    "verificationMethod": [{
      "id": "#key-1",
      "type": "EcdsaSecp256k1VerificationKey2019",
      "controller": "",
      "publicKeyHex": "02a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3"
    }],
    "authentication": ["#key-1"]
  },
  "controllerPublicKeyHex": "02a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3",
  "feePerKb": 10
}
```

**Success Response:**
```json
{
  "status": "success",
  "txid": "a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456",
  "did": "did:bsv:quarkid-test:a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456:1"
}
```

#### 2. Update DID
Updates an existing BSV DID by creating a new transaction that references the previous one.

**Endpoint:** `POST /v1/dids/update`

**Request Body:**
```json
{
  "didToUpdate": "did:bsv:quarkid-test:prev_txid:1",
  "newDidDocument": {
    "@context": ["https://www.w3.org/ns/did/v1"],
    "id": "did:bsv:quarkid-test:prev_txid:1",
    "verificationMethod": [{
      "id": "#key-2",
      "type": "EcdsaSecp256k1VerificationKey2019",
      "controller": "did:bsv:quarkid-test:prev_txid:1",
      "publicKeyHex": "03b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4"
    }],
    "authentication": ["#key-2"]
  },
  "currentBrc48TxHex": "0100000001...",
  "currentBrc48Vout": 1,
  "currentBrc48Satoshis": 1000,
  "currentControllerPrivateKeyHex": "a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456789",
  "feePerKb": 10
}
```

**Success Response:**
```json
{
  "status": "success",
  "txid": "b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456789a",
  "did": "did:bsv:quarkid-test:b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456789a:1"
}
```

#### 3. Resolve DID
Retrieves the current DID document for a given BSV DID.

**Endpoint:** `GET /v1/dids/resolve/:did`

**Parameters:**
- `did`: The BSV DID to resolve (URL encoded)

**Example Request:**
```
GET /v1/dids/resolve/did%3Absv%3Aquarkid-test%3Aa1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456%3A1
```

**Success Response:**
```json
{
  "status": "success",
  "didDocument": {
    "@context": ["https://www.w3.org/ns/did/v1"],
    "id": "did:bsv:quarkid-test:a1b2c3d4e5f6789012345678901234567890abcdef123456:1",
    "verificationMethod": [{
      "id": "#key-1",
      "type": "EcdsaSecp256k1VerificationKey2019",
      "controller": "did:bsv:quarkid-test:a1b2c3d4e5f6789012345678901234567890abcdef123456:1",
      "publicKeyHex": "02a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3"
    }],
    "authentication": ["#key-1"]
  }
}
```

## Configuration

### Environment Variables

Create a `.env` file in the project root with the following variables:

```bash
# Required: 64-character hex private key for wallet operations
MEDICAL_LICENSE_CERTIFIER=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef

# BSV DID Configuration
DID_TOPIC=quarkid-test
OVERLAY_PROVIDER_URL=https://overlay.provider.com

# Optional: Database configuration
MONGODB_URI=mongodb://localhost:27017

# Optional: Server configuration
PORT=3000

# Optional: BSV network configuration
DEFAULT_FUNDING_PUBLIC_KEY_HEX=02a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3
FEE_PER_KB=10
```

### Required Environment Variables

| Variable | Description | Format | Example |
|----------|-------------|---------|---------|
| `MEDICAL_LICENSE_CERTIFIER` | Private key for wallet operations | 64-character hex string | `0123456789abcdef...` |
| `DID_TOPIC` | BSV overlay topic identifier | String | `quarkid-test` |
| `OVERLAY_PROVIDER_URL` | BSV overlay node endpoint | URL | `https://overlay.provider.com` |

### Optional Environment Variables

| Variable | Description | Default | Example |
|----------|-------------|---------|---------|
| `MONGODB_URI` | MongoDB connection string | None | `mongodb://localhost:27017` |
| `PORT` | HTTP server port | `3000` | `8080` |
| `DEFAULT_FUNDING_PUBLIC_KEY_HEX` | Default funding public key | None | `02a1b2c3d4e5f6...` |
| `FEE_PER_KB` | Transaction fee rate | `10` | `20` |

## Installation & Setup

### Prerequisites

- Node.js v18+ 
- npm v8+
- TypeScript v4+
- (Optional) MongoDB v5+

### Installation Steps

1. **Clone and navigate to the project:**
   ```bash
   cd /path/to/quarkID/register/back
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure environment variables:**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Build the project:**
   ```bash
   npm run build
   # Or with TypeScript lib checking disabled:
   npx tsc --skipLibCheck
   ```

5. **Start the server:**
   ```bash
   npm start
   # Or for development:
   npm run dev
   ```

### Verification

Test that the BSV DID service is running:

```bash
curl -X GET http://localhost:3000/health
```

Test BSV DID endpoint accessibility:
```bash
curl -X POST http://localhost:3000/v1/dids/create \
  -H "Content-Type: application/json" \
  -d '{"didDocument": {"@context": ["https://www.w3.org/ns/did/v1"]}}'
```

## Usage Examples

### JavaScript/Node.js Client

```javascript
const axios = require('axios');

const baseURL = 'http://localhost:3000/v1/dids';

// Create a new DID
async function createDID() {
  const didDocument = {
    "@context": ["https://www.w3.org/ns/did/v1"],
    "id": "",
    "verificationMethod": [{
      "id": "#key-1",
      "type": "EcdsaSecp256k1VerificationKey2019",
      "controller": "",
      "publicKeyHex": "02a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3"
    }],
    "authentication": ["#key-1"]
  };

  try {
    const response = await axios.post(`${baseURL}/create`, {
      didDocument,
      controllerPublicKeyHex: "02a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3",
      feePerKb: 10
    });
    
    console.log('DID Created:', response.data.did);
    return response.data;
  } catch (error) {
    console.error('Error creating DID:', error.response?.data || error.message);
  }
}

// Resolve a DID
async function resolveDID(did) {
  try {
    const encodedDID = encodeURIComponent(did);
    const response = await axios.get(`${baseURL}/resolve/${encodedDID}`);
    
    console.log('DID Document:', response.data.didDocument);
    return response.data;
  } catch (error) {
    console.error('Error resolving DID:', error.response?.data || error.message);
  }
}
```

### cURL Examples

**Create DID:**
```bash
curl -X POST http://localhost:3000/v1/dids/create \
  -H "Content-Type: application/json" \
  -d '{
    "didDocument": {
      "@context": ["https://www.w3.org/ns/did/v1"],
      "id": "",
      "verificationMethod": [{
        "id": "#key-1",
        "type": "EcdsaSecp256k1VerificationKey2019",
        "controller": "",
        "publicKeyHex": "02a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3"
      }],
      "authentication": ["#key-1"]
    },
    "controllerPublicKeyHex": "02a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3",
    "feePerKb": 10
  }'
```

**Resolve DID:**
```bash
curl -X GET "http://localhost:3000/v1/dids/resolve/did%3Absv%3Aquarkid-test%3Aa1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456%3A1"
```

## Error Handling

### Common Error Responses

#### Insufficient Funds
```json
{
  "status": "error",
  "description": "No suitable UTXOs found for transaction funding"
}
```

#### Invalid DID Format
```json
{
  "status": "error", 
  "description": "Invalid DID format provided"
}
```

#### DID Not Found
```json
{
  "status": "error",
  "description": "DID not found"
}
```

#### Service Unavailable
```json
{
  "status": "error",
  "description": "BsvDidService not initialized"
}
```

### Error Categories

| Status Code | Category | Description |
|-------------|----------|-------------|
| 400 | Bad Request | Invalid input parameters or malformed requests |
| 404 | Not Found | DID does not exist or cannot be resolved |
| 500 | Internal Error | Server-side errors, service unavailable |
| 503 | Service Unavailable | External dependencies unavailable (MongoDB, BSV network) |

## Production Deployment

### Infrastructure Requirements

- **Compute**: 2+ CPU cores, 4GB+ RAM
- **Storage**: 20GB+ for application, logs, and temporary files
- **Network**: Reliable internet connection for BSV network access
- **Database**: MongoDB instance (optional but recommended)

### Production Environment Variables

```bash
# Production configuration
NODE_ENV=production
PORT=8080

# BSV Network (Mainnet)
OVERLAY_PROVIDER_URL=https://mainnet.overlay.provider.com
DID_TOPIC=quarkid-production

# Security: Use secure key management
MEDICAL_LICENSE_CERTIFIER=${SECURE_PRIVATE_KEY}

# Database
MONGODB_URI=mongodb://prod-mongodb:27017/quarkid

# Monitoring and logging
LOG_LEVEL=info
```

### Security Considerations

1. **Private Key Management**:
   - Use secure key management systems (AWS KMS, HashiCorp Vault)
   - Never commit private keys to version control
   - Rotate keys regularly

2. **Network Security**:
   - Use HTTPS in production
   - Implement rate limiting
   - Configure firewalls appropriately

3. **Authentication**:
   - Ensure BSV auth middleware is properly configured
   - Validate all input parameters
   - Implement proper session management

### Deployment Options

#### Docker Deployment
```dockerfile
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 3000
CMD ["npm", "start"]
```

#### PM2 Process Management
```bash
pm2 start dist/app.js --name "quarkid-bsv-api"
pm2 startup
pm2 save
```

## Troubleshooting

### Common Issues

#### 1. "No suitable UTXOs found"
**Symptom**: API returns 400 error about UTXOs
**Solution**: Ensure the wallet has sufficient BSV and UTXOs for transaction creation

#### 2. "BsvDidService not initialized"
**Symptom**: API returns 500 error about service
**Solutions**: 
- Check that `DID_TOPIC` and `OVERLAY_PROVIDER_URL` are set
- Verify environment variables are properly loaded
- Check server logs for initialization errors

#### 3. "MongoDB not available"
**Symptom**: Some features disabled, MongoDB connection errors
**Solutions**:
- Start MongoDB service
- Check connection string in `MONGODB_URI`
- Verify network connectivity to MongoDB

#### 4. "Cannot resolve DID"
**Symptom**: DID resolution fails
**Solutions**:
- Verify overlay provider URL is accessible
- Check that the DID exists on the BSV network
- Ensure proper URL encoding for DID parameter

### Debug Mode

Enable debug logging by setting:
```bash
LOG_LEVEL=debug
DEBUG=quarkid:*
```

### Health Checks

Monitor these endpoints for service health:
- `GET /` - Basic server response
- `GET /v1/dids/resolve/<test-did>` - BSV service functionality

### Logs

Key log locations:
- Application logs: `console.log` output
- BSV transaction logs: Look for `[BsvDidService]` prefixes
- Route logs: Look for `[Route /dids/*]` prefixes

---

## Support

For issues and questions:
1. Check this documentation
2. Review server logs
3. Verify environment configuration
4. Test with minimal examples

For development support, see the main QuarkID documentation and BSV SDK documentation.
