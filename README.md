# BlockMed - Blockchain Prescription Management System

A comprehensive blockchain-based prescription management system using Decentralized Identifiers (DIDs) and Verifiable Credentials (VCs) on Bitcoin SV overlay network with extended QuarkID packages.

## Overview

BlockMed demonstrates a complete prescription workflow with four main actors:

- **Patients**: Receive prescriptions, share with pharmacies, confirm receipt
- **Doctors**: Create and issue prescriptions as Verifiable Credentials
- **Pharmacies**: Verify prescriptions, dispense medications, track status
- **Insurance**: Receive prescription copies for coverage verification

The system leverages QuarkID and Bitcoin SV for immutable prescription tracking, preventing fraud and double-spending through a token-based system.

## Prerequisites

- Node.js (v18 or newer)
- Docker (v20 or newer)
- npm (v8 or newer)
- Git
- (Optional) [Metanet Desktop](https://metanet.bsvb.tech/) (for funding the PLATFORM_FUNDING_KEY)

## Quick Start

The easiest way to get started is using the included Makefile, Metanet Desktop, Docker:

```bash
# Make sure you have Metanet Desktop, Docker, and Node.js installed

# Clone the repository
git clone git@github.com:sirdeggen/register.git
cd register

# Complete setup and run all services with one command
make quickstart
```

This will:

1. Install all dependencies
2. Build the extended version of QuarkID
3. Setup the environment (including keys and funding)
4. Start all services (Frontend, Backend, and Overlay)

## Manual Setup Guide

If you prefer to set up components individually:


### 1. Install Dependencies

```bash
# Install all dependencies for QuarkID, frontend, backend, and overlay
make install

# Or install individually
make install-quarkid
make install-frontend
make install-backend
make install-overlay
```

### 2. Build QuarkID

```bash
# Build QuarkID
make build-quarkid
```

### 3. Environment Setup

```bash
# Create environment files from examples
make setup-env
```

### 4. Run Services

```bash
# Run all services concurrently
make run

# Or run services individually in separate terminals
make run-overlay   # Runs on http://localhost:8080
make run-backend   # Runs on http://localhost:3000
make run-frontend  # Runs on http://localhost:5174

# Run only frontend and backend (no overlay)
make run-app
```

## Development Workflow

```bash
# Start in development mode with hot reload
make dev

# Check service status
make status

# Build all components
make build

# Run linters
make lint

# Clean project (remove node_modules and build artifacts)
make clean
```

## Using the Application

### 1. Initial Setup - Create Actors

```bash
# From the register root directory
npx tsx back/src/scripts/seedActors.ts
```

or manually:

1. Open <http://localhost:5173> in your browser
2. Click on "Actor Management"
3. Create at least one actor for each role:
   - **Patient**: Name (e.g., "John Doe"), Type: patient
   - **Doctor**: Name (e.g., "Dr. Smith"), Type: doctor  
   - **Pharmacy**: Name (e.g., "City Pharmacy"), Type: pharmacy
   - **Insurance**: Name (e.g., "Health Insurance Co"), Type: insurance

Each actor creation generates a DID on the BSV overlay network.

### 2. Login and Test Workflows

1. Go to <http://localhost:5173> in your browser
2. Select an actor (e.g., the doctor you created)
3. You'll be redirected to the appropriate dashboard

### 3. Create a Prescription (as Doctor)

1. Go to <http://localhost:5173> in your browser
2. Select a doctor
3. You'll be redirected to the appropriate dashboard
4. If you used the seedActors.ts script, you can select the green "Create Test Prescription" button to automatically create a prescription for John Doe. Otherwise, you can create a prescription manually:
5. Select a patient from the dropdown
6. Fill in prescription details:
   - Medication name
   - Dosage
   - Frequency
   - Duration
   - Diagnosis
   - Notes
7. Submit the prescription

### 4. Share with Pharmacy (as Patient)

1. Go to <http://localhost:5173> in your browser
2. Select the patient you created the prescription for
3. You'll be redirected to the appropriate dashboard
4. Click "Share with Pharmacy" next to the prescription you created in the table at the bottom of the page
5. Select the pharmacy
6. Confirm sharing

### 5. Dispense Medication (as Pharmacy)

1. Go to <http://localhost:5173> in your browser
2. Select the pharmacy you shared the prescription with
3. You'll be redirected to the appropriate dashboard
4. Click "Dispense" on the prescription you shared with the pharmacy
5. Enter batch number (e.g., 1234567890), expiry date (e.g., 2025-01-01), and pharmacy note (e.g., "Dispensed by City Pharmacy")
6. Confirm dispensation

### 6. Confirm Medication Received (as Patient)

1. Go to <http://localhost:5173> in your browser
2. Select the patient you created the prescription for
3. You'll be redirected to the appropriate dashboard
4. Click "Confirm" beside the prescription the patient received
5. Confirm the medication received

## Project Structure

```plaintext
register/
├── Makefile                 # Automation for setup and running
├── back/                    # Backend Express server
│   ├── src/
│   │   ├── routes/         # API endpoints
│   │   ├── services/       # Business logic
│   │   ├── models/         # MongoDB models
│   │   └── plugins/        # BSV overlay integrations
│   └── package.json
├── front/                   # Frontend React application
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── services/       # API client services
│   │   └── context/        # React context providers
│   └── package.json
└── overlay/                 # BSV overlay service (LARS)
    ├── services/           # Overlay service implementations
    └── package.json
```

## Makefile Commands Reference

```bash
make help                    # Show all available commands

# Quick Start
make quickstart             # Complete setup and run
make                        # Install, link, and run

# Service Control
make run                    # Run all services
make run-app               # Run frontend and backend only
make run-frontend          # Run frontend only
make run-backend           # Run backend only
make run-overlay           # Run overlay service only
make status                # Check service status

# Setup & Build
make install               # Install all dependencies
make link-quarkid          # Link QuarkID packages
make build                 # Build all components
make setup-env             # Setup environment files

# Cleanup
make clean                 # Remove node_modules and builds
make deep-clean            # Clean and unlink packages
make unlink-quarkid        # Unlink QuarkID packages

# MongoDB
make mongo-start           # Start MongoDB container
make mongo-stop            # Stop MongoDB container

# Development
make dev                   # Development mode
make lint                  # Run linters
make test                  # Run tests
```

## Troubleshooting

### Common Issues

1. **"back doesn't start'"**
   - Run `make setup-env` to setup the environment

2. **"Failed to connect to MongoDB"**
   - Ensure overlay is running: `make run-overlay`

3. **"BSV overlay service unavailable"**
   - Run `make status` to check services
   - Ensure overlay is running: `make run-overlay`

4. **"Failed to create DID"**
   - Ensure the DID_TOPIC in .env matches LARS configuration
   - Check backend console for detailed error messages

### Development Tips

- Backend runs with `tsx` for ES module compatibility
- Frontend uses Vite for fast HMR (Hot Module Replacement)
- Both support TypeScript with strict mode
- Services run concurrently with proper signal handling

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

- **`clearPrescriptions.ts`** - Clears all prescriptions from the database for a fresh start

  ```bash
  npx tsx src/scripts/clearPrescriptions.ts
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
