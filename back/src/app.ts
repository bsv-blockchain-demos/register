import express from "express";
import bodyParser from 'body-parser'
import { MongoClient } from "mongodb";
import { transform, IdentityRecord } from "./didTranslation";
import { createAuthMiddleware } from '@bsv/auth-express-middleware'
import { WalletClient, PrivateKey, KeyDeriver } from '@bsv/sdk'
import { WalletStorageManager, Services, Wallet, StorageClient } from '@bsv/wallet-toolbox-client'
import { signCertificate } from "./routes/signCertificate";
import { createDidRoutes } from "./routes/didRoutes";
import { BsvDidService } from "./services/bsvDidService";
import { config } from 'dotenv'
import cors from 'cors'
config();

// Environment variables for BsvDidService
const DID_TOPIC = process.env.DID_TOPIC;
const OVERLAY_PROVIDER_URL = process.env.OVERLAY_PROVIDER_URL;
const DEFAULT_FUNDING_PUBLIC_KEY_HEX = process.env.DEFAULT_FUNDING_PUBLIC_KEY_HEX; // Optional
const FEE_PER_KB = process.env.FEE_PER_KB ? parseInt(process.env.FEE_PER_KB, 10) : undefined; // Optional


const medicalKey = process.env.MEDICAL_LICENSE_CERTIFIER!

const walletStorageUrl = 'https://storage.babbage.systems'

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
    
    const wallet: Wallet = await createWalletClient(medicalKey) // Explicitly type wallet
    const auth = createAuthMiddleware({ wallet })
    
    const client = new MongoClient("mongodb://localhost:27017");
    client.connect();

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
        req.db = client.db("LARS_lookup_services");
        req.wallet = wallet
        next();
    })

    app.get("/v1/:subject", async (req, res) => {
        const subject = req.params.subject;
        const record = await req.db
            .collection("identityRecords")
            .findOne({ 'certificate.subject': subject });
        const did = transform(record as IdentityRecord);
        res.json(did);
    });

    app.use(auth).post("/signCertificate", signCertificate.func)
    // Instantiate BsvDidService
    if (!DID_TOPIC || !OVERLAY_PROVIDER_URL) {
      console.error('Missing DID_TOPIC or OVERLAY_PROVIDER_URL in environment variables. BSV DID routes will not be available.');
    } else {
      const bsvDidService = new BsvDidService({
        walletClient: wallet, // The existing WalletClient from createWalletClient
        topic: DID_TOPIC,
        overlayProviderUrl: OVERLAY_PROVIDER_URL,
        feePerKb: FEE_PER_KB,
        defaultFundingPublicKeyHex: DEFAULT_FUNDING_PUBLIC_KEY_HEX,
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