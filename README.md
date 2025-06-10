# QuarkID BSV Prescription Management System

A comprehensive blockchain-based prescription management system using Decentralized Identifiers (DIDs) and Verifiable Credentials (VCs) on Bitcoin SV overlay network.

## Overview

This application provides a complete prescription workflow with three main actors:

- **Frontend**: React application for doctors, pharmacies, and patients to manage prescriptions
- **Backend**: Express server handling DID operations, VC issuance, BSV token management, and DWN messaging

The system leverages Bitcoin SV blockchain overlay for immutable prescription tracking, preventing fraud and double-spending through a token-based system.

## Prerequisites

- Node.js (v18 or newer)
- MongoDB (v6.0 or newer)
- npm or yarn
- BSV wallet with funding for blockchain transactions
- Access to BSV overlay network
- DWN (Decentralized Web Node) endpoint

## Project Structure

```
register/
├── back/             # Backend Express server
│   ├── src/          # TypeScript source files
│   └── package.json  # Backend dependencies
└── front/            # Frontend React application
    ├── src/          # TypeScript React components
    └── package.json  # Frontend dependencies
```

## Installation

### Clone the repository

```bash
git clone https://github.com/yourusername/register.git
cd register
```

### Backend Setup

1. Navigate to the backend directory:

```bash
cd back
```

2. Install dependencies:

```bash
npm install
```

3. Create a `.env` file in the `back` directory with the following content:

```
# BSV Wallet Configuration
MEDICAL_LICENSE_CERTIFIER=your_private_key_here
DEFAULT_FUNDING_PUBLIC_KEY_HEX=your_funding_public_key_hex
FEE_PER_KB=1000

# BSV Overlay Configuration
DID_TOPIC=quarkid-prescription
OVERLAY_PROVIDER_URL=https://overlay.quarkid.com

# DWN Configuration
DWN_ENDPOINT=https://dwn.quarkid.com

# MongoDB Configuration
MONGO_URI=mongodb://localhost:27017/prescription_system
```

4. Make sure MongoDB is running locally:

```bash
# Start MongoDB if not running as a service
mongod --dbpath /path/to/data/directory
```

5. Build and start the backend server:

```bash
npm run build
npm start
```

For development with hot-reload:

```bash
npm run dev
```

### Frontend Setup

1. Navigate to the frontend directory:

```bash
cd front
```

2. Install dependencies:

```bash
npm install
```

3. Start the development server:

```bash
npm run dev
```

## Prescription Workflow

### 1. DID Creation & Actor Setup
1. Start the backend server (port 3000) and frontend (port 5173)
2. Navigate to **Actor Management** to create DIDs for:
   - Patients
   - Doctors  
   - Pharmacies
   - Health Insurance Providers
3. Each actor gets a BSV-based DID stored on the blockchain overlay

### 2. Prescription Process (Doctor → Patient)
1. Doctor scans patient's QR code to verify their DID
2. Doctor inputs prescription details (medication, dosage, diagnosis)
3. **Prescripcion VC** is created and encrypted
4. BSV token created with "no dispensado" status
5. Encrypted VC sent to patient and insurance via DWN

### 3. Pharmacy Dispensation (Patient → Pharmacy)
1. Patient sends Prescripcion VC to pharmacy by scanning pharmacy QR
2. Pharmacy verifies prescription status on BSV blockchain
3. Pharmacy adds medication batch information
4. **Dispensa VC** created with dispensation details
5. Token ownership transferred, status remains "no dispensado"
6. Encrypted Dispensa VC sent to patient via DWN

### 4. Confirmation (Patient Confirms Receipt)
1. Patient confirms medication receipt
2. **Confirmacion VC** created with timestamp
3. Final BSV transaction updates status to "dispensado"
4. Confirmation VC sent to pharmacy and insurance
5. System prevents fraud through blockchain immutability

## API Endpoints

### DID Management
- `POST /v1/dids/create` - Create a new BSV DID
- `GET /v1/dids/:did` - Resolve a DID document
- `PUT /v1/dids/:did` - Update a DID document

### Prescription Workflow
- `POST /v1/prescriptions` - Create a new prescription VC
- `GET /v1/prescriptions/:id` - Get prescription details
- `POST /v1/prescriptions/:id/dispense` - Create dispensation VC
- `POST /v1/prescriptions/:id/confirm` - Create confirmation VC

### BSV Token Management
- `POST /v1/tokens` - Create prescription token
- `PUT /v1/tokens/:txid/transfer` - Transfer token ownership
- `GET /v1/tokens/:txid/status` - Check token status

### DWN Messaging
- `POST /v1/dwn/send` - Send encrypted VC via DWN
- `GET /v1/dwn/messages` - Retrieve DWN messages

### Legacy Support
- `GET /v1/:subject` - Retrieve identity record (legacy)
- `POST /signCertificate` - Sign medical certificate (legacy)

## Technologies

### Frontend
- **React 18** with TypeScript
- **Vite** for fast development
- **QR Code** generation and scanning
- **Encrypted messaging** with public key cryptography

### Backend  
- **Express.js** with TypeScript
- **MongoDB** for caching and metadata storage
- **BSV SDK** for blockchain transactions
- **Wallet Toolbox Client** for UTXO management

### Blockchain & Identity
- **Bitcoin SV (BSV)** overlay network for DID storage
- **QuarkID DID Registry** for BSV-based DIDs
- **Verifiable Credentials** (W3C standard)
- **DWN (Decentralized Web Node)** for secure messaging
- **Token-based** fraud prevention system

### Security
- **End-to-end encryption** for VC transmission
- **Digital signatures** for VC authenticity
- **Blockchain immutability** for audit trails
- **Private key** management for actors

## Development

### Building the Projects

Backend:
```bash
cd back
npm run build
```

Frontend:
```bash
cd front
npm run build
```

### Linting

```bash
npm run lint
```

## License

[Add your license information here]
