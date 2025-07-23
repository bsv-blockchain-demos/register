import 'dotenv/config';
import express from "express";
import bodyParser from 'body-parser'
import { MongoClient, Db } from "mongodb";
import { PrivateKey, WalletClient, KeyDeriver } from '@bsv/sdk';
import { WalletStorageManager, Services, StorageClient, Wallet } from '@bsv/wallet-toolbox-client';
import { createAuthMiddleware } from '@bsv/auth-express-middleware';
import { ActorService } from './services/ActorService';
import { QuarkIdAgentService } from './services/quarkIdAgentService';
import { PrescriptionTokenService } from './services/prescriptionTokenService';
import { VCTokenService } from './services/vcTokenService';
import { InsuranceFraudPreventionService } from './services/InsuranceFraudPreventionService';
import { DWNStorageService, createDWNStorageService } from './services/DWNStorageService';
import { PrescriptionDWNService, createPrescriptionDWNService } from './services/PrescriptionDWNService';
import { KMSClient } from '@quarkid/kms-client';
import { LANG } from '@quarkid/kms-core';
import cors from 'cors'
import { createDidRoutes } from './routes/didRoutes';
import { createVcRoutes } from './routes/vcRoutes';
import { createActorRoutes } from './routes/actorRoutes';
import { createStatusRoutes } from './routes/statusRoutes';
import { createPrescriptionRoutes } from './routes/prescriptionRoutes';
import { createRegisterRoutes } from './routes/registerRoutes';
import { createTokenRoutes } from './routes/tokenRoutes';
import { createDWNRoutes } from './routes/dwnRoutes';
import { createVCTokenRoutes } from './routes/vcTokenRoutes';
import { createFraudPreventionRoutes } from './routes/fraudPreventionRoutes';
import enhancedActorRoutes from './routes/enhancedActorRoutes';
import enhancedPrescriptionRoutes from './routes/enhancedPrescriptionRoutes';

import { appConfig } from './config/AppConfig';

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

export const createWalletClient = async (key: string): Promise<{ wallet: Wallet; walletClient: WalletClient }> => {
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
    const client = new StorageClient(wallet, appConfig.walletStorageUrl)
    await storage.addWalletStorageProvider(client)
    await storage.makeAvailable()
    return { wallet, walletClient: new WalletClient(wallet) }
}

let db: Db
let actorService: ActorService
let quarkIdAgentService: QuarkIdAgentService
let prescriptionTokenService: PrescriptionTokenService
let vcTokenService: VCTokenService
let dwnStorageService: DWNStorageService
let prescriptionDWNService: PrescriptionDWNService
let kmsClient: KMSClient
let fraudPreventionService: InsuranceFraudPreventionService

async function startServer() {
    const app = express();
    const port = appConfig.port;
    app.use(bodyParser.json())
    app.use(cors())
    
    const { wallet, walletClient }: { wallet: Wallet; walletClient: WalletClient } = await createWalletClient(appConfig.platformFundingKey) // Explicitly type wallet
    const auth = createAuthMiddleware({ 
      wallet: walletClient,
      allowUnauthenticated: true // Allow requests without auth for testing
    })

    // Initialize database connection
    console.log('Connecting to MongoDB...');
    const client = new MongoClient(appConfig.mongoUri);
    await client.connect();
    db = client.db(appConfig.dbName);
    console.log('Connected to MongoDB successfully');

    // Initialize DWN Storage Service using the same storage as wallet
    console.log('[App] Initializing DWN Storage Service with wallet storage...');
    dwnStorageService = createDWNStorageService(walletClient);

    // Initialize QuarkIdAgentService
    quarkIdAgentService = new QuarkIdAgentService({
      mongodb: appConfig.mongoConfig,
      wallet: wallet,
      walletClient: walletClient,
      overlayProvider: appConfig.overlayProviderUrl,
      dwnUrl: appConfig.dwnUrl
    });

    // Initialize Prescription DWN Service for secure VC sharing
    console.log('[App] Initializing Prescription DWN Service...');
    prescriptionDWNService = createPrescriptionDWNService(dwnStorageService, quarkIdAgentService);

    // Initialize ActorService
    actorService = new ActorService(
      db,
      walletClient,
      quarkIdAgentService,
      appConfig.overlayConfig
    );

    // Initialize consolidated VC Token Service first
    vcTokenService = new VCTokenService(
      db,
      walletClient,
      quarkIdAgentService
    );

    // Initialize KMSClient with BBS+ support for fraud prevention
    console.log('[App] Initializing KMSClient for fraud prevention...');
    
    // Create a simple storage implementation for KMS
    const kmsStorage = {
      add: async (key: string, value: any) => {
        await db.collection('kms_storage').insertOne({ key, value, createdAt: new Date() });
      },
      get: async (key: string) => {
        const result = await db.collection('kms_storage').findOne({ key });
        return result?.value;
      },
      getAll: async () => {
        const results = await db.collection('kms_storage').find({}).toArray();
        const map = new Map<string, any>();
        results.forEach(r => map.set(r.key, r.value));
        return map;
      },
      update: async (key: string, value: any) => {
        await db.collection('kms_storage').updateOne(
          { key },
          { $set: { value, updatedAt: new Date() } },
          { upsert: true }
        );
      },
      remove: async (key: string) => {
        await db.collection('kms_storage').deleteOne({ key });
      }
    };

    // Create a simple DID resolver for fraud prevention
    const fraudPreventionDIDResolver = async (did: string) => {
      try {
        // Try to resolve through existing QuarkID agent first
        const resolved = await quarkIdAgentService.resolveDID(did);
        if (resolved) {
          return resolved;
        }
      } catch (error) {
        console.warn(`[App] Could not resolve DID ${did} through QuarkID agent:`, error.message);
      }

      // Fallback to basic DID document structure
      return {
        id: did,
        '@context': ['https://www.w3.org/ns/did/v1', 'https://w3id.org/security/bbs/v1'],
        verificationMethod: [{
          id: `${did}#key1`,
          type: 'Bls12381G2Key2020',
          controller: did,
          publicKeyBase58: 'mock_public_key_for_fraud_prevention'
        }],
        authentication: [`${did}#key1`],
        assertionMethod: [`${did}#key1`],
        keyAgreement: [`${did}#key1`],
        capabilityDelegation: [`${did}#key1`],
        capabilityInvocation: [`${did}#key1`]
      };
    };

    // Initialize KMS Client with BBS+ support
    kmsClient = new KMSClient({
      lang: LANG.en,
      storage: kmsStorage as any,
      didResolver: fraudPreventionDIDResolver as any,
      mobile: false // Enable BBS+ suite
    });

    // Initialize Insurance Fraud Prevention Service
    console.log('[App] Initializing Insurance Fraud Prevention Service...');
    fraudPreventionService = new InsuranceFraudPreventionService(
      db,
      walletClient,
      kmsClient,
      vcTokenService,
      quarkIdAgentService,
      fraudPreventionDIDResolver as any
    );

    // Initialize Prescription Token Service after all dependencies are ready
    prescriptionTokenService = new PrescriptionTokenService(
      db,
      walletClient,
      {
        endpoint: appConfig.overlayProviderUrl,
        topic: appConfig.prescriptionTopic
      },
      quarkIdAgentService,
      kmsClient,
      fraudPreventionService,
      vcTokenService
    );

    // Logging middleware to print request path and body
    app.use((req, res, next) => {
        console.log('=== REQUEST MIDDLEWARE TRIGGERED ===');
        console.log(`[${req.method}] ${req.path} ${JSON.stringify(req?.body || '')}`);
        console.log('=== END REQUEST LOG ===');
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
        req.dwnStorage = dwnStorageService
        req.prescriptionDWNService = prescriptionDWNService
        req.quarkIdActorService = actorService
        req.quarkIdAgentService = quarkIdAgentService
        req.prescriptionTokenService = prescriptionTokenService
        req.vcTokenService = vcTokenService
        req.kmsClient = kmsClient
        req.fraudPreventionService = fraudPreventionService
        next();
    })

    // Root API documentation route (no auth required) - MUST be first
    app.get('/', (req, res) => {
      res.json({
        name: 'QuarkID Prescription Backend API',
        version: '1.0.0',
        status: 'running',
        mongodb: !!db ? 'connected' : 'not connected',
        walletClient: !!walletClient ? 'connected' : 'not connected',
        actorService: !!actorService ? 'connected' : 'not connected',
        quarkIdAgentService: !!quarkIdAgentService ? 'connected' : 'not connected',
        prescriptionTokenService: !!prescriptionTokenService ? 'connected' : 'not connected',
        vcTokenService: !!vcTokenService ? 'connected' : 'not connected',
        kmsClient: !!kmsClient ? 'connected' : 'not connected',
        fraudPreventionService: !!fraudPreventionService ? 'connected' : 'not connected',
        endpoints: {
          actors: '/v1/actors (GET, POST)',
          prescriptions: '/v1/prescriptions (GET, POST)',
          tokens: '/v1/tokens (GET, POST)',
          dwn: '/v1/dwn/messages (GET, POST)',
          dids: '/v1/dids (GET, POST)',
          vcs: '/v1/vcs/* (VC operations)',
          vcTokens: '/v1/vc-tokens/* (Consolidated VC Token operations)',
          fraudPrevention: '/v1/fraud-prevention/* (Insurance fraud prevention with BBS+ ZKPs)',
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
          note: 'Enhanced BSV overlay routes for full token integration',
          actors: '/v1/enhanced/actors/* (CRUD operations with BSV DIDs)',
          prescriptions: '/v1/enhanced/prescriptions/* (Token-based prescription lifecycle)'
        },
        vcTokenEndpoints: {
          create: '/v1/vc-tokens/create (POST) - Create VC with BSV token atomically',
          transfer: '/v1/vc-tokens/transfer (POST) - Transfer token ownership',
          finalize: '/v1/vc-tokens/finalize (POST) - Mark token as used/completed',
          get: '/v1/vc-tokens/:tokenId (GET) - Get specific token',
          list: '/v1/vc-tokens/list (GET) - List tokens with filters',
          verify: '/v1/vc-tokens/verify/:tokenId (POST) - Verify token',
          stats: '/v1/vc-tokens/stats/summary (GET) - Get statistics',
          prescriptionCreate: '/v1/vc-tokens/prescription/create (POST) - Create prescription token',
          prescriptionDispense: '/v1/vc-tokens/prescription/dispense (POST) - Transfer to pharmacy'
        },
        fraudPreventionEndpoints: {
          prescriptionCreate: '/v1/fraud-prevention/prescription/create (POST) - Doctor creates prescription with BBS+ signature',
          prescriptionVerify: '/v1/fraud-prevention/prescription/verify (POST) - Pharmacy verifies prescription',
          dispensingCreate: '/v1/fraud-prevention/dispensing/create (POST) - Pharmacy creates dispensing proof',
          insuranceVerify: '/v1/fraud-prevention/insurance/verify (POST) - Insurance verifies claim with ZKP',
          disclosure: '/v1/fraud-prevention/prescription/:id/disclosure (GET) - Get selective disclosure for actors',
          auditFullDisclosure: '/v1/fraud-prevention/audit/full-disclosure (POST) - Auditor requests full disclosure',
          demoWorkflow: '/v1/fraud-prevention/demo/complete-workflow (POST) - Complete workflow demonstration',
          statistics: '/v1/fraud-prevention/statistics (GET) - Get fraud prevention statistics'
        },
        fraudPreventionFeatures: {
          security: 'Role-based access control, rate limiting, real-time fraud monitoring',
          privacy: 'BBS+ selective disclosure, zero-knowledge proofs, minimal data exposure',
          compliance: 'Audit trails, blockchain anchoring, regulatory compliance ready',
          demonstration: 'Complete workflow demo available with normal and fraud scenarios'
        }
      });
    });

    app.use('/v1/dids', createDidRoutes(quarkIdAgentService));
    app.use('/v1/vcs', createVcRoutes(quarkIdAgentService));
    app.use('/v1/actors', createActorRoutes());
    app.use('/v1/prescriptions', createPrescriptionRoutes());
    app.use('/v1/tokens', createTokenRoutes());
    app.use('/v1/vc-tokens', createVCTokenRoutes(vcTokenService));
    app.use('/v1/fraud-prevention', createFraudPreventionRoutes());
    app.use('/v1/dwn', createDWNRoutes());
    app.use('/v1/status', createStatusRoutes(db));
    app.use('/register', createRegisterRoutes(db));

    // Enhanced BSV overlay routes
    app.use('/v1/enhanced/actors', enhancedActorRoutes);
    app.use('/v1/enhanced/prescriptions', enhancedPrescriptionRoutes);

    // This catch-all route MUST come after all other /v1/* routes
    // Otherwise it will intercept requests meant for specific routes
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

    app.get('/health', (req, res) => {
      console.log('=== HEALTH ROUTE HIT ===');
      res.json({
        status: 'ok',
        mongodb: !!db ? 'connected' : 'not connected',
        walletClient: !!walletClient ? 'connected' : 'not connected',
        actorService: !!actorService ? 'connected' : 'not connected',
        quarkIdAgentService: !!quarkIdAgentService ? 'connected' : 'not connected',
        prescriptionTokenService: !!prescriptionTokenService ? 'connected' : 'not connected',
        vcTokenService: !!vcTokenService ? 'connected' : 'not connected',
        kmsClient: !!kmsClient ? 'connected' : 'not connected',
        fraudPreventionService: !!fraudPreventionService ? 'connected' : 'not connected'
      });
    });

    app.listen(port, () => {
        console.log(`Server started on port ${port}`);
        console.log('Testing console.log after server start:', new Date());
        console.log('Console.log function type:', typeof console.log);
        console.log('Console.log function:', console.log.toString().substring(0, 100));
    });
}

startServer();