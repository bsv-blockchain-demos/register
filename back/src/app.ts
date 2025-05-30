import express from "express";
import bodyParser from 'body-parser'
import { MongoClient } from "mongodb";
import { transform, IdentityRecord } from "./didTranslation";
import { createAuthMiddleware } from '@bsv/auth-express-middleware'
import { WalletClient, PrivateKey, KeyDeriver } from '@bsv/sdk'
import { WalletStorageManager, Services, Wallet, StorageClient } from '@bsv/wallet-toolbox-client'
import { signCertificate } from "./routes/signCertificate"
import { config } from 'dotenv'
import cors from 'cors'
config()


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
    
    const wallet = await createWalletClient(medicalKey)
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
    app.use(auth).post("/.well-known/auth", (req, res, next) => {
        console.log({req, res, next})
        next()
    })

    app.listen(3000, () => {
        console.log("Server started on port 3000");
    });
}

startServer()