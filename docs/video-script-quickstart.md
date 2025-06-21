# Quick Start Video Script: BSV DID Prescription Management System

## Video Overview
**Duration**: ~5-7 minutes  
**Audience**: Developers wanting to quickly set up and run the system  
**Goal**: Get the system running with minimal configuration

---

## Introduction [0:00-0:30]

"Welcome! In this quick start guide, I'll show you how to get the BSV DID Prescription Management System up and running in just a few minutes.

This system demonstrates blockchain-based prescription management using:
- Bitcoin SV overlay protocol for DIDs
- QuarkID for decentralized identity
- Verifiable Credentials for prescriptions
- A complete workflow from doctor to pharmacy

Let's jump right in!"

---

## Prerequisites Check [0:30-1:00]

"Before we start, make sure you have:
- Node.js version 18 or higher
- MongoDB installed or Docker to run it
- Git for cloning the repository
- A code editor like VS Code

You'll also need some BSV for transaction fees, but we'll cover that in a moment."

---

## Step 1: Clone and Setup [1:00-1:30]

```bash
# Clone the repository
git clone [repository-url]
cd register

# Install dependencies for both backend and frontend
cd back
npm install

cd ../front
npm install
```

"First, clone the repository and install dependencies for both the backend and frontend applications."

---

## Step 2: Environment Configuration [1:30-2:30]

"Now let's configure the environment variables. Copy the example files:"

```bash
# In the back directory
cd back
cp .env.example .env

# In the front directory  
cd ../front
cp .env.example .env
```

"Open the backend .env file and you'll see these critical settings:
- `PLATFORM_FUNDING_KEY`: Your BSV wallet private key that funds all blockchain operations
- `DID_TOPIC` and `VC_TOPIC`: Topic identifiers for BSV overlay (default to 'tm_did' and 'tm_vc')
- `OVERLAY_PROVIDER_URL`: LARS overlay service URL (default: localhost:8080)
- `MONGODB_URI`: MongoDB connection string

Both private keys should be 64-character hexadecimal strings. These control the wallet that pays for all DID creation and transaction fees on the BSV blockchain.

For development, most defaults work fine. Just add funded BSV private keys."

---

## Step 3: Start Required Services [2:30-3:30]

"Let's start the required services. First, MongoDB:"

```bash
# Using Docker
docker run -d -p 27017:27017 --name mongodb mongo:latest
```

"Next, start the LARS overlay service for DID indexing:"

```bash
# From the overlay directory
cd ../overlay
docker-compose up -d
```

"LARS acts as our local BSV overlay service for development."

---

## Step 4: Start the Applications [3:30-4:30]

"Now start both the backend and frontend:"

```bash
# Terminal 1 - Backend
cd back
npm run dev

# Terminal 2 - Frontend  
cd front
npm run dev
```

"The backend runs on port 3000 and the frontend on port 5173."

---

## Step 5: First Run - Create Actors [4:30-5:30]

"Open your browser to http://localhost:5173

1. Click 'Create Test Actors' to generate sample DIDs
2. You'll see Doctor, Patient, Pharmacy, and Insurance actors created
3. Each actor gets a unique BSV DID like: `did:bsv:tm_did:abc123...`

Behind the scenes, these DIDs are registered on the BSV blockchain!"

---

## Step 6: Create a Prescription [5:30-6:30]

"Now let's create a prescription:

1. Go to Doctor Dashboard
2. Fill in prescription details:
   - Select a patient
   - Add medication and dosage
   - Set validity dates
3. Click 'Create Prescription'

The system creates a Verifiable Credential signed by the doctor's DID and associates it with a BSV token."

---

## Troubleshooting Tips [6:30-7:00]

"Common issues:
- 'Insufficient funds': Add BSV to your wallet
- 'QuarkIdAgentService not initialized': Check MongoDB is running
- 'Cannot resolve DID': Ensure LARS is running and accessible

Check the full documentation for detailed troubleshooting."

---

## Conclusion [7:00]

"That's it! You now have a working prescription management system using BSV DIDs and Verifiable Credentials.

For a deep dive into the architecture and code, check out our technical explainer video.

Happy coding!"

---

## Screen Recording Notes

**Key screens to capture:**
1. Terminal showing service startup
2. Browser showing actor creation
3. Doctor dashboard prescription form
4. Success messages and created prescriptions
5. MongoDB/LARS logs showing DID creation

**Highlight:**
- Quick copy/paste commands
- Default values that work
- Success indicators
- Where to find more help
