import 'dotenv/config';
import express from "express";
import bodyParser from 'body-parser'
import { MongoClient, Db } from "mongodb";
import { PrivateKey, WalletClient, KeyDeriver } from '@bsv/sdk';
import { WalletStorageManager, Services, Wallet, StorageClient } from '@bsv/wallet-toolbox-client';
import { createAuthMiddleware } from '@bsv/auth-express-middleware';
import { QuarkIdActorService } from './services/quarkIdActorService';
import cors from 'cors'
import { BsvDidService } from './services/bsvDidService';
import { BsvVcService } from './services/bsvVcService';
import vcRoutes from './routes/vcs';
import { createActorRoutes } from './routes/actorRoutes';
import { createPrescriptionRoutes } from './routes/prescriptionRoutes';
import { createTokenRoutes } from './routes/tokenRoutes';
import { createDWNRoutes } from './routes/dwnRoutes';

// Environment variables
const mongoUri = process.env.MONGO_URI || "mongodb://localhost:27017"
const medicalKey = process.env.MEDICAL_LICENSE_CERTIFIER
const PORT = process.env.PORT || 3000
const requiredEnvVars = {
  MEDICAL_LICENSE_CERTIFIER: process.env.MEDICAL_LICENSE_CERTIFIER,
  DID_TOPIC: process.env.DID_TOPIC || 'quarkid-test',
  VC_TOPIC: process.env.VC_TOPIC || 'quarkid-test',
  OVERLAY_PROVIDER_URL: process.env.OVERLAY_PROVIDER_URL || 'https://overlay.test.com',
  DEFAULT_FUNDING_PUBLIC_KEY_HEX: process.env.DEFAULT_FUNDING_PUBLIC_KEY_HEX,
  FEE_PER_KB: process.env.FEE_PER_KB
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

let db: Db
let quarkIdActorService: QuarkIdActorService
let bsvDidService: BsvDidService
let bsvVcService: BsvVcService

async function startServer() {
    const app = express();
    const port = PORT;
    app.use(bodyParser.json())
    app.use(cors())
    
    const walletClient: WalletClient = await createWalletClient(medicalKey) // Explicitly type wallet
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

    // Initialize BSV DID Service
    const didTopic = process.env.DID_TOPIC || 'quarkid-test';
    const vcTopic = process.env.VC_TOPIC || 'quarkid-test';
    const overlayProviderUrl = process.env.OVERLAY_PROVIDER_URL || 'https://overlay.test.com';
    const feePerKb = parseInt(process.env.FEE_PER_KB || '50');

    bsvDidService = new BsvDidService({
      walletClient,
      topic: didTopic,
      overlayProviderUrl,
      feePerKb
    });

    // Initialize BSV VC Service
    bsvVcService = new BsvVcService({
      walletClient,
      topic: vcTopic,
      overlayProviderUrl,
      feePerKb
    });

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
        req.bsvDidService = bsvDidService
        req.bsvVcService = bsvVcService
        next();
    })

    // Root API documentation route (no auth required) - MUST be first
    app.get('/', (req, res) => {
      res.json({
        name: 'QuarkID Prescription Backend API',
        version: '1.0.0',
        status: 'running',
        mongodb: !!db ? 'connected' : 'not connected',
        bsvDidService: !!bsvDidService ? 'connected' : 'not connected',
        bsvVcService: !!bsvVcService ? 'connected' : 'not connected',
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

    app.get("/v1/dids", async (req, res) => {
        if (!req.bsvDidService) {
          res.status(503).json({ error: 'BSV DID Service not available' });
          return;
        }
        const dids = await req.bsvDidService.getDids();
        res.json(dids);
    });

    app.post("/v1/dids", async (req, res) => {
        if (!req.bsvDidService) {
          res.status(503).json({ error: 'BSV DID Service not available' });
          return;
        }
        const did = await req.bsvDidService.createDid(req.body);
        res.json(did);
    });

    // Mount VC routes
    app.use('/v1/vcs', vcRoutes);

    app.get("/v1/vcs", async (req, res) => {
        if (!req.bsvVcService) {
          res.status(503).json({ error: 'BSV VC Service not available' });
          return;
        }
        const vcs = await req.bsvVcService.getVcs();
        res.json(vcs);
    });

    app.post("/v1/vcs", async (req, res) => {
        if (!req.bsvVcService) {
          res.status(503).json({ error: 'BSV VC Service not available' });
          return;
        }
        const vc = await req.bsvVcService.createVc(req.body);
        res.json(vc);
    });

    app.use('/v1/actors', createActorRoutes());
    app.use('/v1/prescriptions', createPrescriptionRoutes());
    app.use('/v1/tokens', createTokenRoutes());
    app.use('/v1/dwn', createDWNRoutes());

    app.listen(port, () => {
        console.log(`Server started on port ${port}`);
    });
}

startServer();