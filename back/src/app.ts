import 'dotenv/config';
import express from "express";
import bodyParser from 'body-parser'
import { MongoClient, Db } from "mongodb";
import { PrivateKey, WalletClient, KeyDeriver } from '@bsv/sdk';
import { WalletStorageManager, Services, Wallet, StorageClient } from '@bsv/wallet-toolbox-client';
import { createAuthMiddleware } from '@bsv/auth-express-middleware';
import { QuarkIdActorService } from './services/quarkIdActorService';
import { QuarkIdAgentService } from './services/quarkIdAgentService';
import { PrescriptionTokenService } from './services/prescriptionTokenService';
import cors from 'cors'
import { createDidRoutes } from './routes/didRoutes';
import { createVcRoutes } from './routes/vcRoutes';
import { createActorRoutes } from './routes/actorRoutes';
import { createStatusRoutes } from './routes/statusRoutes';
import { createPrescriptionRoutes } from './routes/prescriptionRoutes';
import { createRegisterRoutes } from './routes/registerRoutes';
import { createTokenRoutes } from './routes/tokenRoutes';
import { createDWNRoutes } from './routes/dwnRoutes';

// Environment variables
const mongoUri = process.env.MONGO_URI || "mongodb://localhost:27017"
const medicalKey = process.env.MEDICAL_LICENSE_CERTIFIER
const PORT = process.env.PORT || 3000
const PLATFORM_FUNDING_KEY = process.env.PLATFORM_FUNDING_KEY
const requiredEnvVars = {
  MEDICAL_LICENSE_CERTIFIER: process.env.MEDICAL_LICENSE_CERTIFIER,
  DID_TOPIC: process.env.DID_TOPIC || 'quarkid-test',
  VC_TOPIC: process.env.VC_TOPIC || 'quarkid-test',
  OVERLAY_PROVIDER_URL: process.env.OVERLAY_PROVIDER_URL || 'https://overlay.test.com',
  DEFAULT_FUNDING_PUBLIC_KEY_HEX: process.env.DEFAULT_FUNDING_PUBLIC_KEY_HEX,
  FEE_PER_KB: process.env.FEE_PER_KB,
};

if (!medicalKey) {
  throw new Error('MEDICAL_LICENSE_CERTIFIER environment variable is required')
}

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
    const chain = 'main' // Reverted back to 'main' to resolve build issues first
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

let db: Db
let quarkIdActorService: QuarkIdActorService
let quarkIdAgentService: QuarkIdAgentService
let prescriptionTokenService: PrescriptionTokenService

async function startServer() {
    const app = express();
    const port = PORT;
    app.use(bodyParser.json())
    app.use(cors())
    
    const walletClient: WalletClient = await createWalletClient(PLATFORM_FUNDING_KEY) // Explicitly type wallet
    const auth = createAuthMiddleware({ 
      wallet: walletClient,
      allowUnauthenticated: true // Allow requests without auth for testing
    })

    // Initialize database connection
    console.log('Connecting to MongoDB...');
    const client = new MongoClient(mongoUri);
    await client.connect();
    db = client.db("LARS_lookup_services");
    console.log('Connected to MongoDB successfully');

    // Initialize QuarkIdActorService
    quarkIdActorService = new QuarkIdActorService(
      db,
      walletClient
      // Agent and DidRegistry will be added later when properly configured
    );

    // Initialize QuarkIdAgentService
    quarkIdAgentService = new QuarkIdAgentService({
      mongodb: {
        uri: process.env.MONGODB_URI || 'mongodb://localhost:27017',
        dbName: 'quarkid'
      },
      walletClient: walletClient,
      overlayProvider: process.env.OVERLAY_PROVIDER_URL || 'https://overlay.test.com',
      dwnUrl: process.env.DWN_URL
    });

    // Initialize Prescription Token Service
    prescriptionTokenService = new PrescriptionTokenService(
      db,
      walletClient,
      {
        endpoint: process.env.OVERLAY_PROVIDER_URL || 'https://overlay.test.com',
        topic: process.env.PRESCRIPTION_TOPIC || 'prescriptions'
      }
    );

    // Logging middleware to print request path and body
    app.use((req, res, next) => {
        console.log(`[${req.method}] ${req.path} ${JSON.stringify(req?.body || '')}`);
        next();
    });


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
        req.db = db;
        req.walletClient = walletClient
        req.quarkIdActorService = quarkIdActorService
        req.quarkIdAgentService = quarkIdAgentService
        req.prescriptionTokenService = prescriptionTokenService
        next();
    })

    // Root API documentation route (no auth required) - MUST be first
    app.get('/', (req, res) => {
      res.json({
        name: 'QuarkID Prescription Backend API',
        version: '1.0.0',
        status: 'running',
        mongodb: !!db ? 'connected' : 'not connected',
        quarkIdAgentService: !!quarkIdAgentService ? 'connected' : 'not connected',
        prescriptionTokenService: !!prescriptionTokenService ? 'connected' : 'not connected',
        endpoints: {
          actors: '/v1/actors (GET, POST)',
          prescriptions: '/v1/prescriptions (GET, POST)',
          tokens: '/v1/tokens (GET, POST)',
          dwn: '/v1/dwn/messages (GET, POST)',
          dids: '/v1/dids (GET, POST)',
          vcs: '/v1/vcs/* (VC operations)',
          auth: '/.well-known/auth (POST)'
        },
        vcEndpoints: {
          issue: '/v1/vcs/issue (POST)',
          revoke: '/v1/vcs/revoke (POST)', 
          resolve: '/v1/vcs/resolve/:vcId (GET)',
          getBySubject: '/v1/vcs/subject/:subjectDid (GET)',
          getByIssuer: '/v1/vcs/issuer/:issuerDid (GET)',
          health: '/v1/vcs/health (GET)'
        },
        enhanced: {
          note: 'Enhanced BSV overlay routes temporarily disabled due to import issues',
          planned: [
            '/v1/enhanced/actors',
            '/v1/enhanced/prescriptions'
          ]
        }
      });
    });

    app.get("/v1/:subject", async (req, res) => {
        if (!db) {
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

    app.use('/v1/dids', createDidRoutes(quarkIdAgentService));
    app.use('/v1/vcs', createVcRoutes(quarkIdAgentService));
    app.use('/v1/actors', createActorRoutes());
    app.use('/v1/prescriptions', createPrescriptionRoutes());
    app.use('/v1/tokens', createTokenRoutes());
    app.use('/v1/dwn', createDWNRoutes());
    app.use('/v1/status', createStatusRoutes(db));
    app.use('/register', createRegisterRoutes(db));

    app.get('/health', (req, res) => {
      res.json({
        status: 'ok',
        mongodb: !!db ? 'connected' : 'not connected',
        walletClient: !!walletClient ? 'connected' : 'not connected',
        quarkIdAgentService: !!quarkIdAgentService ? 'connected' : 'not connected',
        prescriptionTokenService: !!prescriptionTokenService ? 'connected' : 'not connected'
      });
    });

    app.listen(port, () => {
        console.log(`Server started on port ${port}`);
    });
}

startServer();