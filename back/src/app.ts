import 'dotenv/config';
import express from "express";
import bodyParser from 'body-parser'
import { MongoClient } from "mongodb";
import { PrivateKey, WalletClient, KeyDeriver } from '@bsv/sdk';
import { WalletStorageManager, Services, Wallet, StorageClient } from '@bsv/wallet-toolbox-client';
import { createAuthMiddleware } from '@bsv/auth-express-middleware';
import { signCertificate } from "./routes/signCertificate";
import { createDidRoutes } from "./routes/didRoutes";
import { BsvDidService } from "./services/bsvDidService";
import cors from 'cors'

// Validate required environment variables
const requiredEnvVars = {
  MEDICAL_LICENSE_CERTIFIER: process.env.MEDICAL_LICENSE_CERTIFIER,
  DID_TOPIC: process.env.DID_TOPIC || 'quarkid-test',
  OVERLAY_PROVIDER_URL: process.env.OVERLAY_PROVIDER_URL || 'https://overlay.test.com',
  DEFAULT_FUNDING_PUBLIC_KEY_HEX: process.env.DEFAULT_FUNDING_PUBLIC_KEY_HEX,
  FEE_PER_KB: process.env.FEE_PER_KB
};

if (!requiredEnvVars.MEDICAL_LICENSE_CERTIFIER) {
  console.error('MEDICAL_LICENSE_CERTIFIER environment variable is required');
  process.exit(1);
}

// Validate hex string format
if (!/^[0-9a-fA-F]{64}$/.test(requiredEnvVars.MEDICAL_LICENSE_CERTIFIER)) {
  console.error('MEDICAL_LICENSE_CERTIFIER must be a 64-character hexadecimal string');
  process.exit(1);
}

if (requiredEnvVars.DEFAULT_FUNDING_PUBLIC_KEY_HEX && !/^[0-9a-fA-F]{64}$/.test(requiredEnvVars.DEFAULT_FUNDING_PUBLIC_KEY_HEX)) {
  console.error('DEFAULT_FUNDING_PUBLIC_KEY_HEX must be a 64-character hexadecimal string');
  process.exit(1);
}

if (requiredEnvVars.FEE_PER_KB && isNaN(parseInt(requiredEnvVars.FEE_PER_KB, 10))) {
  console.error('FEE_PER_KB must be a valid integer');
  process.exit(1);
}

const medicalKey = requiredEnvVars.MEDICAL_LICENSE_CERTIFIER;
const walletStorageUrl = 'https://storage.babbage.systems'

// Simple identity record interface
interface IdentityRecord {
  certificate: {
    subject: string;
  }
}

// Simple transform function placeholder
const transform = (record: IdentityRecord | null) => {
  if (!record) return null;
  return {
    id: `did:example:${record.certificate.subject}`,
    subject: record.certificate.subject
  };
};

export const createWalletClient = async (key: string): Promise<WalletClient> => {
    const rootKey = PrivateKey.fromHex(key)
    const keyDeriver = new KeyDeriver(rootKey)
    const storage = new WalletStorageManager(keyDeriver.identityKey)
    const chain = 'main'
    const services = new Services(chain)
    const wallet = new Wallet({
        chain,
        keyDeriver,
        storage,
        services,
    })
    const client = new StorageClient(wallet, walletStorageUrl)
    await storage.addWalletStorageProvider(client)
    await storage.makeAvailable()
    return new WalletClient(wallet)
}

async function startServer() {
    const app = express();
    app.use(bodyParser.json())
    app.use(cors())
    
    const walletClient: WalletClient = await createWalletClient(medicalKey) // Explicitly type wallet
    const auth = createAuthMiddleware({ 
      wallet: walletClient,
      allowUnauthenticated: true // Allow requests without auth for testing
    })
    
    // Try to connect to MongoDB, but don't fail if it's not available
    let mongoConnected = false;
    let client: MongoClient | null = null;
    try {
      client = new MongoClient("mongodb://localhost:27017");
      await client.connect();
      mongoConnected = true;
      console.log('Connected to MongoDB');
    } catch (error) {
      console.warn('MongoDB not available, some features will be disabled:', error.message);
    }

    app.use((req, res, next) => {
        res.header('Access-Control-Allow-Origin', '*')
        res.header('Access-Control-Allow-Headers', '*')
        res.header('Access-Control-Allow-Methods', '*')
        res.header('Access-Control-Expose-Headers', '*')
        res.header('Access-Control-Allow-Private-Network', 'true')
        if (req.method === 'OPTIONS') {
            // Handle CORS preflight requests to allow cross-origin POST/PUT requests
            res.sendStatus(200)
        } else {
            next()
        }
    })

    app.use((req, res, next) => {
        if (mongoConnected) {
          req.db = client.db("LARS_lookup_services");
        }
        req.walletClient = walletClient
        next();
    })

    app.get("/v1/:subject", async (req, res) => {
        if (!mongoConnected) {
          res.status(503).json({ error: 'MongoDB not available' });
          return;
        }
        const subject = req.params.subject;
        const record = await req.db
            .collection("identityRecords")
            .findOne({ 'certificate.subject': subject });
        const did = transform(record as IdentityRecord);
        res.json(did);
    });

    app.use(auth).post("/signCertificate", signCertificate.func)
    // Instantiate BsvDidService
    if (!requiredEnvVars.DID_TOPIC || !requiredEnvVars.OVERLAY_PROVIDER_URL) {
      console.error('Missing DID_TOPIC or OVERLAY_PROVIDER_URL in environment variables. BSV DID routes will not be available.');
    } else {
      const bsvDidService = new BsvDidService({
        walletClient: walletClient,
        topic: requiredEnvVars.DID_TOPIC,
        overlayProviderUrl: requiredEnvVars.OVERLAY_PROVIDER_URL,
        feePerKb: requiredEnvVars.FEE_PER_KB ? parseInt(requiredEnvVars.FEE_PER_KB, 10) : undefined,
        defaultFundingPublicKeyHex: requiredEnvVars.DEFAULT_FUNDING_PUBLIC_KEY_HEX,
      });

      // Register DID routes
      const didRouter = createDidRoutes(bsvDidService);
      app.use('/v1/dids', auth, didRouter); // Prefixing with /v1 for consistency, and applying auth
    }

    app.use(auth).post("/.well-known/auth", (req, res, next) => {
        console.log({req, res, next})
        next()
    })

    app.listen(3000, () => {
        console.log("Server started on port 3000");
    });
}

startServer()