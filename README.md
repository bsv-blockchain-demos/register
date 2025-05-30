# Register - Medical Certificate DID System

A blockchain-based system for issuing and verifying medical practitioner certificates using Digital Identity (DID) documents.

## Overview

This application consists of:

- **Frontend**: React application for doctors to request and display medical certificates
- **Backend**: Express server that handles certificate issuance and DID document management

The system leverages blockchain technology (BSV) to create verifiable digital credentials for medical practitioners, ensuring the authenticity and immutability of medical licenses.

## Prerequisites

- Node.js (v18 or newer)
- MongoDB (v6.0 or newer)
- npm or yarn

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
MEDICAL_LICENSE_CERTIFIER=your_private_key_here
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

## Usage

1. Start the backend server (port 3000)
2. Start the frontend application (typically on port 5173)
3. Open your browser and navigate to `http://localhost:5173`
4. Use the "Register Doctor" button to create a new medical certificate
5. The signed certificate will be displayed on the page when successful

## API Endpoints

- `GET /v1/:subject` - Retrieve a DID document for a specific subject
- `POST /signCertificate` - Sign a medical certificate (requires authentication)

## Technologies

- **Frontend**: React, TypeScript, Vite
- **Backend**: Express.js, MongoDB, TypeScript
- **Blockchain**: BSV SDK, Wallet Toolbox Client
- **Digital Identity**: DID Core

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
