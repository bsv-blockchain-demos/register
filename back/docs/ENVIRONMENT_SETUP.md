# Environment Setup Guide

## Overview

This guide covers the complete environment setup for the BSV DID integration in the QuarkID backend, including development, testing, and production configurations.

## Prerequisites

### System Requirements

- **Node.js**: Version 18 or higher
- **npm**: Version 8 or higher
- **TypeScript**: Version 4 or higher
- **MongoDB**: Version 5 or higher (optional)
- **Operating System**: macOS, Linux, or Windows with WSL2

### Development Tools

- **Code Editor**: VS Code recommended with TypeScript extension
- **Git**: For version control
- **curl/Postman**: For API testing
- **Docker**: For containerized deployment (optional)

## Environment Variables

### Required Variables

Create a `.env` file in the project root with these required variables:

```bash
# BSV Wallet Configuration
MEDICAL_LICENSE_CERTIFIER=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef

# BSV DID Configuration
DID_TOPIC=quarkid-test
OVERLAY_PROVIDER_URL=https://overlay-node.example.com
```

### Optional Variables

```bash
# Database Configuration
MONGODB_URI=mongodb://localhost:27017/quarkid

# Server Configuration
PORT=3000
NODE_ENV=development

# BSV Network Configuration
DEFAULT_FUNDING_PUBLIC_KEY_HEX=02a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3
FEE_PER_KB=10

# Logging Configuration
LOG_LEVEL=info
DEBUG=quarkid:*
```

## Variable Descriptions

### MEDICAL_LICENSE_CERTIFIER
- **Type**: String (64 characters)
- **Format**: Hexadecimal private key
- **Purpose**: Private key for wallet operations and transaction signing
- **Security**: NEVER commit this to version control
- **Generation**: Use `openssl rand -hex 32` or similar secure method

### DID_TOPIC
- **Type**: String
- **Format**: Alphanumeric identifier
- **Purpose**: BSV overlay topic for DID operations
- **Example**: `quarkid-test`, `quarkid-production`
- **Note**: Must match the overlay service configuration

### OVERLAY_PROVIDER_URL
- **Type**: String (URL)
- **Format**: HTTP/HTTPS URL
- **Purpose**: BSV overlay node endpoint for DID resolution
- **Example**: `https://overlay-node.example.com`
- **Note**: Must be accessible from the backend server

## Environment-Specific Configurations

### Development Environment

```bash
# .env.development
NODE_ENV=development
PORT=3000
LOG_LEVEL=debug
DEBUG=quarkid:*

# Use test/development values
DID_TOPIC=quarkid-dev
OVERLAY_PROVIDER_URL=https://dev-overlay.example.com
MEDICAL_LICENSE_CERTIFIER=dev_private_key_hex_64_chars...

# Optional local MongoDB
MONGODB_URI=mongodb://localhost:27017/quarkid-dev
```

### Testing Environment

```bash
# .env.test
NODE_ENV=test
PORT=3001
LOG_LEVEL=warn

# Use test-specific values
DID_TOPIC=quarkid-test
OVERLAY_PROVIDER_URL=https://test-overlay.example.com
MEDICAL_LICENSE_CERTIFIER=test_private_key_hex_64_chars...

# Test database
MONGODB_URI=mongodb://localhost:27017/quarkid-test
```

### Production Environment

```bash
# .env.production
NODE_ENV=production
PORT=8080
LOG_LEVEL=info

# Use production values
DID_TOPIC=quarkid-production
OVERLAY_PROVIDER_URL=https://mainnet-overlay.example.com

# Secure key management (use secrets manager)
MEDICAL_LICENSE_CERTIFIER=${SECURE_PRIVATE_KEY}

# Production database
MONGODB_URI=mongodb://prod-mongodb-cluster:27017/quarkid-prod
```

## Setup Instructions

### 1. Clone and Install

```bash
# Clone repository
git clone <repository-url>
cd quarkID/register/back

# Install dependencies
npm install
```

### 2. Environment Configuration

```bash
# Copy example environment file
cp .env.example .env

# Edit with your values
nano .env  # or use your preferred editor
```

### 3. Private Key Generation

Generate a secure private key for the wallet:

```bash
# Using OpenSSL
openssl rand -hex 32

# Using Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Using Python
python3 -c "import secrets; print(secrets.token_hex(32))"
```

### 4. MongoDB Setup (Optional)

If using MongoDB:

```bash
# Install MongoDB locally
brew install mongodb-community  # macOS
# OR
sudo apt-get install mongodb     # Ubuntu

# Start MongoDB service
brew services start mongodb-community  # macOS
# OR
sudo systemctl start mongod             # Ubuntu

# Verify connection
mongo --eval "db.runCommand({ connectionStatus: 1 })"
```

### 5. Verify Configuration

```bash
# Check environment variables
npm run env-check  # if available

# Or manually verify
node -e "
require('dotenv').config();
console.log('Required vars:', {
  MEDICAL_LICENSE_CERTIFIER: process.env.MEDICAL_LICENSE_CERTIFIER ? 'SET' : 'MISSING',
  DID_TOPIC: process.env.DID_TOPIC || 'MISSING',
  OVERLAY_PROVIDER_URL: process.env.OVERLAY_PROVIDER_URL || 'MISSING'
});
"
```

## Security Considerations

### Private Key Security

1. **Never commit private keys to version control**
2. **Use environment-specific keys**
3. **Implement key rotation policies**
4. **Use secure key management systems in production**

### Recommended Security Practices

```bash
# Add .env to .gitignore
echo ".env" >> .gitignore
echo ".env.*" >> .gitignore

# Set proper file permissions
chmod 600 .env

# Use environment variable validation
npm install joi dotenv
```

### Environment Variable Validation

Create a validation script:

```javascript
// scripts/validate-env.js
const Joi = require('joi');
require('dotenv').config();

const schema = Joi.object({
  MEDICAL_LICENSE_CERTIFIER: Joi.string().length(64).hex().required(),
  DID_TOPIC: Joi.string().alphanum().required(),
  OVERLAY_PROVIDER_URL: Joi.string().uri().required(),
  MONGODB_URI: Joi.string().uri().optional(),
  PORT: Joi.number().port().default(3000),
  NODE_ENV: Joi.string().valid('development', 'test', 'production').default('development'),
  LOG_LEVEL: Joi.string().valid('error', 'warn', 'info', 'debug').default('info'),
  FEE_PER_KB: Joi.number().positive().default(10)
});

const { error, value } = schema.validate(process.env);

if (error) {
  console.error('Environment validation failed:', error.details);
  process.exit(1);
}

console.log('Environment validation passed');
```

## Docker Configuration

### Dockerfile Environment

```dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci --only=production

# Copy source code
COPY . .

# Build application
RUN npm run build

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Expose port
EXPOSE 3000

# Start application
CMD ["npm", "start"]
```

### Docker Compose

```yaml
# docker-compose.yml
version: '3.8'

services:
  quarkid-backend:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - MONGODB_URI=mongodb://mongodb:27017/quarkid
    env_file:
      - .env
    depends_on:
      - mongodb

  mongodb:
    image: mongo:5
    ports:
      - "27017:27017"
    volumes:
      - mongodb_data:/data/db

volumes:
  mongodb_data:
```

## Troubleshooting

### Common Issues

#### Missing Environment Variables
```bash
# Error: Environment variable not set
# Solution: Check .env file and ensure all required variables are set

# Debug environment loading
node -e "require('dotenv').config(); console.log(process.env.MEDICAL_LICENSE_CERTIFIER ? 'SET' : 'NOT SET')"
```

#### Invalid Private Key Format
```bash
# Error: Invalid private key
# Solution: Ensure key is 64-character hex string

# Validate private key format
node -e "
const key = process.env.MEDICAL_LICENSE_CERTIFIER;
console.log('Length:', key?.length);
console.log('Is hex:', /^[0-9a-fA-F]+$/.test(key));
"
```

#### MongoDB Connection Issues
```bash
# Error: MongoDB connection refused
# Solution: Ensure MongoDB is running and accessible

# Test MongoDB connection
mongosh --eval "db.runCommand({ ping: 1 })"

# Check MongoDB service status
brew services list | grep mongodb  # macOS
systemctl status mongod             # Linux
```

#### Overlay Service Connection
```bash
# Error: Overlay service unavailable
# Solution: Verify URL and network connectivity

# Test overlay service
curl -X GET "${OVERLAY_PROVIDER_URL}/health"
```

### Environment Debugging

```bash
# Check all environment variables
npm run env-debug

# Or create a debug script
node -e "
require('dotenv').config();
console.log('Environment variables:');
Object.keys(process.env)
  .filter(key => key.startsWith('MEDICAL_') || key.startsWith('DID_') || key.startsWith('OVERLAY_'))
  .forEach(key => console.log(\`\${key}: \${process.env[key] ? 'SET' : 'NOT SET'}\`));
"
```

## Production Deployment

### AWS/Cloud Deployment

```bash
# Use AWS Secrets Manager
aws secretsmanager create-secret \
  --name "quarkid/medical-license-certifier" \
  --secret-string "your-private-key-here"

# Use environment variables in deployment
export MEDICAL_LICENSE_CERTIFIER=$(aws secretsmanager get-secret-value \
  --secret-id "quarkid/medical-license-certifier" \
  --query SecretString --output text)
```

### Kubernetes Deployment

```yaml
# k8s-secret.yaml
apiVersion: v1
kind: Secret
metadata:
  name: quarkid-secrets
type: Opaque
data:
  medical-license-certifier: <base64-encoded-private-key>
---
apiVersion: v1
kind: ConfigMap
metadata:
  name: quarkid-config
data:
  DID_TOPIC: "quarkid-production"
  OVERLAY_PROVIDER_URL: "https://mainnet-overlay.example.com"
  NODE_ENV: "production"
```

## Environment Monitoring

### Health Checks

```bash
# Create health check endpoint
curl -X GET http://localhost:3000/health

# Environment-specific health check
curl -X GET http://localhost:3000/health/env
```

### Logging Configuration

```javascript
// Configure logging based on environment
const winston = require('winston');

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: process.env.NODE_ENV === 'development' 
        ? winston.format.simple() 
        : winston.format.json()
    })
  ]
});
```

This completes the environment setup guide for the BSV DID integration.
