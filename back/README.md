# QuarkID Backend

## Overview

The QuarkID backend provides comprehensive DID (Decentralized Identifier) management services supporting multiple DID methods including ION and Bitcoin SV (BSV) overlay DIDs.

## BSV DID Integration

This backend includes full support for Bitcoin SV (BSV) overlay DIDs, enabling creation, updating, and resolution of DIDs stored directly on the BSV blockchain.

### Documentation

- **[BSV DID Integration Guide](BSV_DID_INTEGRATION.md)** - Complete overview, architecture, and usage examples
- **[API Reference](docs/API_REFERENCE.md)** - Detailed endpoint documentation with examples
- **[Environment Setup](docs/ENVIRONMENT_SETUP.md)** - Configuration and deployment guide

### Quick Start

1. Set required environment variables:

   ```bash
   DID_TOPIC=your_topic_identifier
   OVERLAY_PROVIDER_URL=https://your-overlay-node.com
   ```

2. Start the server:

   ```bash
   npm start
   ```

3. Create a DID:

   ```bash
   curl -X POST http://localhost:3000/v1/dids/create \
     -H "Content-Type: application/json" \
     -d '{"didDocument": {...}, "controllerPublicKeyHex": "02abc123..."}'
   ```

### Key Features

- **BSV Overlay DID Support**: Create, update, and resolve DIDs on Bitcoin SV
- **Transaction Broadcasting**: Automatic BSV transaction creation and broadcasting
- **Wallet Integration**: Secure key management with BSV SDK
- **REST API**: Clean HTTP endpoints for DID operations
- **Authentication**: Built-in BSV auth middleware
- **Error Handling**: Comprehensive error responses and logging

### API Endpoints

- `POST /v1/dids/create` - Create new BSV DID
- `POST /v1/dids/update` - Update existing BSV DID
- `GET /v1/dids/resolve/:did` - Resolve BSV DID document

For complete documentation and advanced configuration, see the links above.

## VCSL (Verifiable Credential Status List)

VCSL creates the bit array for a particular credential, creates the VC, and it can revoke or unrevoke credentials with status tracking through:

- Bit array persistence
- Bit array address (literally just a bit which gets flipped to 1 when revoked and 0 at first)

## Medical License Use Case

This project demonstrates a complete medical license issuance workflow using Verifiable Credentials on Bitcoin SV:

- Medical License Issuer can create a VC for a doctor
- Doctor can create a VC for a patient
- Pharmacy can verify the VC independently

## TODO

- Define the DID document for the medical license issuer, verifier, doctor, pharmacy, and patient
- Create all the VCs (Verifiable Credentials)
- Create the agent for the medical license issuer
- Create the agent for the doctor
- Create the agent for the pharmacy
- Create the agent for the patient
- Add the possibility to revoke the VCs
- Send notifications if a VC is revoked
