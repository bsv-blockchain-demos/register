# BlockMed - Blockchain Prescription Management System

A comprehensive blockchain-based prescription management system using Decentralized Identifiers (DIDs) and Verifiable Credentials (VCs) on Bitcoin SV overlay network with extended QuarkID packages.

## Overview

BlockMed demonstrates a complete prescription workflow with four main actors:

- **Patients**: Receive prescriptions, share with pharmacies, confirm receipt
- **Doctors**: Create and issue prescriptions as Verifiable Credentials
- **Pharmacies**: Verify prescriptions, dispense medications, track status
- **Insurance**: Receive prescription copies for coverage verification

The system leverages QuarkID and Bitcoin SV blockchain overlay(s) for immutable prescription tracking, preventing fraud and double-spending through a token-based system.

## Prerequisites

- Node.js (v18 or newer)
- MongoDB (v6.0 or newer)
- npm (v8 or newer)
- Git
- BSV overlay service running locally (<http://localhost:8080>)

## Quick Start Guide

### 1. Clone and Link Extended QuarkID Packages

This project requires extended versions of QuarkID packages that include BSV overlay support. These must be linked locally before running the application.

```bash
# Clone the extended QuarkID packages repository
git clone git@jonesjBSV.github.com:jonesjBSV/Paquetes-NPMjs.git
cd Paquetes-NPMjs

# Link the extended packages globally
cd packages/kms-client && npm link
cd ../vc-core && npm link
cd ../agent && npm link
cd ../did-registry && npm link
```

### 2. Set up BlockMed Application

```bash
# The BlockMed demo is included in the BSV extended Paquetes-NPMjs repository
git clone git@jonesjBSV.github.com:jonesjBSV/Paquetes-NPMjs.git
cd Paquetes-NPMjs/register
```

### 3. Backend Setup

```bash
# Navigate to backend
cd back

# Install dependencies
npm install

# Link the extended QuarkID packages
npm link @quarkid/kms-client @quarkid/vc-core @quarkid/agent @quarkid/did-registry

# Create .env file
cat > .env << EOF
# MongoDB Configuration
MONGO_URI=mongodb://localhost:27017/blockmed

# BSV Overlay Configuration
BSV_OVERLAY_URL=<http://localhost:8080>
DID_TOPIC=tm_did
VC_TOPIC=tm_vc

# Wallet Configuration (optional - for testing)
WALLET_SERVICE_URL=<http://localhost:3001>
STORAGE_SERVICE_URL=<http://localhost:3002>
EOF

# Start MongoDB if not running
mongod --dbpath /usr/local/var/mongodb  # Mac
# or
sudo systemctl start mongodb  # Linux

# Run the backend in development mode
npm run dev
```

The backend will start on <http://localhost:3000>

### 4. Frontend Setup

Open a new terminal window:

```bash
# Navigate to frontend (from register directory)
cd front

# Install dependencies
npm install

# Run the frontend in development mode
npm run dev
```

The frontend will start on <http://localhost:5173>

### 5. Verify BSV Overlay Service

Ensure the BSV overlay service (LARS) is running and accessible:

```bash
# Check if overlay service is running
curl <http://localhost:8080/status>
```

If not running, refer to the BSV overlay service documentation for setup.

## Using the Application

### 1. Initial Setup - Create Actors

1. Open <http://localhost:5173> in your browser
2. Click on "Actor Management"
3. Create at least one actor for each role:
   - **Patient**: Name (e.g., "John Doe"), Type: patient
   - **Doctor**: Name (e.g., "Dr. Smith"), Type: doctor  
   - **Pharmacy**: Name (e.g., "City Pharmacy"), Type: pharmacy
   - **Insurance**: Name (e.g., "Health Insurance Co"), Type: insurance

Each actor creation generates a DID on the BSV overlay network.

### 2. Login and Test Workflows

1. Go to Login page
2. Select an actor (e.g., the doctor you created)
3. Click "Login as [Actor Name]"
4. You'll be redirected to the appropriate dashboard

### 3. Create a Prescription (as Doctor)

1. Login as a doctor
2. Go to "Create Prescription"
3. Select a patient from the dropdown
4. Fill in prescription details:
   - Medication name
   - Dosage
   - Frequency
   - Duration
   - Diagnosis
   - Notes
5. Submit the prescription

### 4. Share with Pharmacy (as Patient)

1. Login as a patient
2. View your prescriptions
3. Click "Share with Pharmacy"
4. Select the pharmacy
5. Confirm sharing

### 5. Dispense Medication (as Pharmacy)

1. Login as a pharmacy
2. View shared prescriptions
3. Click "Dispense" on a prescription
4. Enter batch number and expiry date
5. Confirm dispensation

## Project Structure

```plaintext
register/
├── back/                    # Backend Express server
│   ├── src/
│   │   ├── routes/         # API endpoints
│   │   ├── services/       # Business logic
│   │   ├── models/         # MongoDB models
│   │   └── plugins/        # BSV overlay integrations
│   └── package.json
└── front/                   # Frontend React application
    ├── src/
    │   ├── components/     # React components
    │   ├── services/       # API client services
    │   └── context/        # React context providers
    └── package.json
```

## Troubleshooting

### Common Issues

1. **"Cannot find module '@quarkid/...'"**
   - Ensure you've linked all extended QuarkID packages
   - Try `npm ls @quarkid/agent` to verify linkage

2. **"Failed to connect to MongoDB"**
   - Ensure MongoDB is running: `mongod --dbpath /path/to/data`
   - Check MONGO_URI in backend .env file

3. **"BSV overlay service unavailable"**
   - Verify LARS is running on port 8080
   - Check BSV_OVERLAY_URL in backend .env

4. **"Failed to create DID"**
   - Ensure the DID_TOPIC in .env matches LARS configuration
   - Check backend console for detailed error messages

### Development Tips

- Backend runs with `tsx` for ES module compatibility
- Frontend uses Vite for fast HMR (Hot Module Replacement)
- Both support TypeScript with strict mode
- Use `npm run dev` for development with auto-reload

## API Documentation

The backend exposes RESTful APIs under `/v1/`:

- `/v1/actors` - Actor (DID) management
- `/v1/prescriptions` - Prescription creation and management
- `/v1/enhanced/prescriptions` - Token-based prescription workflow
- `/v1/shared-prescriptions` - Prescription sharing between actors

For detailed API documentation, see the route files in `back/src/routes/`.

## Development Scripts

The backend includes several useful scripts in `back/src/scripts/` for development and testing:

### Database Management

- **`seedActors.ts`** - Populates the database with sample actors (doctor, patient, pharmacy, insurance)

  ```bash
  npx tsx src/scripts/seedActors.ts
  ```

- **`clearActors.ts`** - Clears all actors from the database for a fresh start

  ```bash
  npx tsx src/scripts/clearActors.ts
  ```

### Testing & Debugging

- **`testDirectDIDCreation.ts`** - Tests DID creation directly using the BSV overlay service

  ```bash
  npx tsx src/scripts/testDirectDIDCreation.ts
  ```

- **`testEnhancedPrescription.ts`** - Tests the complete enhanced prescription workflow with BSV token creation

  ```bash
  npx tsx src/scripts/testEnhancedPrescription.ts
  ```

### Other Utilities

Additional scripts are available for testing specific features:

- `checkPrescriptions.ts` - Check prescription status
- `testActorEndpoint.ts` - Test actor API endpoints
- `testPrescriptionAPI.ts` - Test prescription creation API
- `testSharePrescription.ts` - Test prescription sharing workflow

## License

[Add your license information here]
