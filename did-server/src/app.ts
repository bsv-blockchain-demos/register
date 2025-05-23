import express from "express";
import { MongoClient } from "mongodb";
import { transform, IdentityRecord } from "./didTranslation";
import { createAuthMiddleware } from '@bsv/auth-express-middleware'
import { WalletClient, PrivateKey, KeyDeriver } from '@bsv/sdk'
import { WalletStorageManager, Services, Wallet, StorageClient } from '@bsv/wallet-toolbox-client'
import { signCertificate } from "./routes/signCertificate";

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
    
    const wallet = await createWalletClient(medicalKey)
    app.use(createAuthMiddleware({ wallet }))
    
    const client = new MongoClient("mongodb://localhost:27017");
    client.connect();
    app.use((req, res, next) => {
        req.db = client.db("LARS_lookup_services");
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

    app.post("/signCertificate", signCertificate.func)

    app.listen(3000, () => {
        console.log("Server started on port 3000");
    });
}

startServer()