# BSV DID API Reference

## Overview

This document provides detailed API reference for the BSV DID endpoints in the QuarkID backend. All endpoints follow RESTful conventions and return JSON responses.

## Base Configuration

- **Base URL**: `http://localhost:3000/v1/dids` (development)
- **Content-Type**: `application/json`
- **Authentication**: Required for all endpoints via BSV auth middleware

## Endpoints

### POST /create

Creates a new BSV DID by broadcasting a transaction to the BSV blockchain.

#### Request

**Headers:**
```
Content-Type: application/json
Authorization: <BSV-Auth-Token>
```

**Body Schema:**
```typescript
{
  didDocument: DIDDocument;
  controllerPublicKeyHex: string;
  feePerKb?: number;
}
```

**Field Descriptions:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `didDocument` | `DIDDocument` | Yes | W3C DID document structure |
| `controllerPublicKeyHex` | `string` | Yes | 66-character hex public key (compressed) |
| `feePerKb` | `number` | No | Transaction fee in satoshis per kilobyte |

**DIDDocument Schema:**
```typescript
{
  "@context": string[];
  "id": string;                    // Will be auto-populated
  "verificationMethod"?: [{
    "id": string;
    "type": string;
    "controller": string;
    "publicKeyHex": string;
  }];
  "authentication"?: string[];
  "service"?: [{
    "id": string;
    "type": string;
    "serviceEndpoint": string;
  }];
}
```

#### Response

**Success (200):**
```json
{
  "status": "success",
  "txid": "a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456",
  "did": "did:bsv:quarkid-test:a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456:1"
}
```

**Error Responses:**

| Status | Error | Description |
|--------|-------|-------------|
| 400 | Invalid input | Missing or malformed request parameters |
| 400 | No suitable UTXOs | Insufficient funds for transaction |
| 500 | Service unavailable | BSV DID service not initialized |
| 500 | Transaction failed | BSV network or overlay service error |

### POST /update

Updates an existing BSV DID by creating a new transaction that references the previous one.

#### Request

**Headers:**
```
Content-Type: application/json
Authorization: <BSV-Auth-Token>
```

**Body Schema:**
```typescript
{
  didToUpdate: string;
  newDidDocument: DIDDocument;
  currentBrc48TxHex: string;
  currentBrc48Vout: number;
  currentBrc48Satoshis: number;
  currentControllerPrivateKeyHex: string;
  feePerKb?: number;
}
```

**Field Descriptions:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `didToUpdate` | `string` | Yes | Existing BSV DID to update |
| `newDidDocument` | `DIDDocument` | Yes | Updated DID document |
| `currentBrc48TxHex` | `string` | Yes | Hex of current transaction |
| `currentBrc48Vout` | `number` | Yes | Output index of current DID |
| `currentBrc48Satoshis` | `number` | Yes | Satoshi value of current UTXO |
| `currentControllerPrivateKeyHex` | `string` | Yes | 64-character hex private key |
| `feePerKb` | `number` | No | Transaction fee in satoshis per kilobyte |

#### Response

**Success (200):**
```json
{
  "status": "success",
  "txid": "b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456789a",
  "did": "did:bsv:quarkid-test:b2c3d4e5f6789012345678901234567890abcdef123456789a:1"
}
```

**Error Responses:**

| Status | Error | Description |
|--------|-------|-------------|
| 400 | Invalid DID format | Malformed `didToUpdate` parameter |
| 400 | Invalid private key | Malformed `currentControllerPrivateKeyHex` |
| 404 | DID not found | `didToUpdate` does not exist |
| 500 | Update failed | Transaction or network error |

### GET /resolve/:did

Retrieves the current DID document for a given BSV DID.

#### Request

**Headers:**
```
Authorization: <BSV-Auth-Token>
```

**Path Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `did` | `string` | Yes | URL-encoded BSV DID to resolve |

**Example URL:**
```
/v1/dids/resolve/did%3Absv%3Aquarkid-test%3Aa1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456%3A1
```

#### Response

**Success (200):**
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

**Error Responses:**

| Status | Error | Description |
|--------|-------|-------------|
| 400 | Invalid DID format | Malformed DID parameter |
| 404 | DID not found | DID does not exist or cannot be resolved |
| 500 | Resolution failed | Overlay service or network error |

## Common Error Format

All error responses follow this format:

```json
{
  "status": "error",
  "description": "Human-readable error message"
}
```

## Authentication

All endpoints require authentication via the BSV auth middleware. Include the authentication token in the `Authorization` header:

```
Authorization: Bearer <token>
```

Or use the BSV-specific authentication format as configured in the middleware.

## Rate Limiting

Currently no rate limiting is implemented, but it's recommended for production deployments.

## CORS Support

The API includes CORS headers allowing cross-origin requests:
- `Access-Control-Allow-Origin: *`
- `Access-Control-Allow-Headers: *`
- `Access-Control-Allow-Methods: *`

## Data Validation

### DID Format Validation
BSV DIDs must match the pattern:
```
did:bsv:<topic>:<txid>:<vout>
```

Where:
- `topic`: Alphanumeric string (configured via `DID_TOPIC`)
- `txid`: 64-character hex string (Bitcoin transaction hash)
- `vout`: Non-negative integer (output index)

### Public Key Format
Public keys must be:
- 66 characters long
- Hex-encoded
- Compressed secp256k1 public key format
- Starting with `02` or `03`

### Private Key Format
Private keys must be:
- 64 characters long
- Hex-encoded
- Valid secp256k1 private key

## Example Integration

### JavaScript/TypeScript Client

```typescript
import axios, { AxiosResponse } from 'axios';

interface BSVDIDService {
  baseURL: string;
  authToken: string;
}

class BSVDIDClient implements BSVDIDService {
  constructor(
    public baseURL: string = 'http://localhost:3000/v1/dids',
    public authToken: string
  ) {}

  private get headers() {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.authToken}`
    };
  }

  async createDID(payload: {
    didDocument: any;
    controllerPublicKeyHex: string;
    feePerKb?: number;
  }): Promise<{ txid: string; did: string }> {
    const response: AxiosResponse = await axios.post(
      `${this.baseURL}/create`,
      payload,
      { headers: this.headers }
    );
    return response.data;
  }

  async updateDID(payload: {
    didToUpdate: string;
    newDidDocument: any;
    currentBrc48TxHex: string;
    currentBrc48Vout: number;
    currentBrc48Satoshis: number;
    currentControllerPrivateKeyHex: string;
    feePerKb?: number;
  }): Promise<{ txid: string; did: string }> {
    const response: AxiosResponse = await axios.post(
      `${this.baseURL}/update`,
      payload,
      { headers: this.headers }
    );
    return response.data;
  }

  async resolveDID(did: string): Promise<{ didDocument: any }> {
    const encodedDID = encodeURIComponent(did);
    const response: AxiosResponse = await axios.get(
      `${this.baseURL}/resolve/${encodedDID}`,
      { headers: this.headers }
    );
    return response.data;
  }
}

// Usage example
const client = new BSVDIDClient('http://localhost:3000/v1/dids', 'your-auth-token');

try {
  const result = await client.createDID({
    didDocument: {
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
    controllerPublicKeyHex: "02a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3"
  });
  
  console.log('Created DID:', result.did);
} catch (error) {
  console.error('Error:', error.response?.data || error.message);
}
```

## Testing

### Unit Tests
```typescript
// Example test structure
describe('BSV DID API', () => {
  describe('POST /create', () => {
    it('should create a new DID with valid input', async () => {
      // Test implementation
    });
    
    it('should return 400 for invalid public key', async () => {
      // Test implementation
    });
  });
});
```

### Integration Tests
```bash
# Test server health
curl -X GET http://localhost:3000/

# Test DID creation (requires auth)
curl -X POST http://localhost:3000/v1/dids/create \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d @test-create-did.json
```

## Performance Considerations

### Response Times
- **Create DID**: 2-5 seconds (depends on BSV network)
- **Update DID**: 2-5 seconds (depends on BSV network)
- **Resolve DID**: 100-500ms (depends on overlay service)

### Throughput
- Limited by BSV network transaction throughput
- Recommend implementing queue for high-volume operations

### Caching
- DID resolution results can be cached
- Cache invalidation needed for DID updates

## Monitoring

### Health Checks
```bash
# Basic health check
curl -X GET http://localhost:3000/

# Service-specific health
curl -X GET http://localhost:3000/v1/dids/health
```

### Metrics to Monitor
- API response times
- BSV transaction success rates
- Error rates by endpoint
- UTXO availability
- Overlay service connectivity
