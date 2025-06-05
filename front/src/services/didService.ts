import { WalletClient as SdkWalletClient, Transaction, LockingScript, UnlockingScript, PublicKey, Utxo, Script } from '@bsv/sdk';
import { Wallet as ToolboxWallet } from '@bsv/wallet-toolbox-client';
import {
    BsvOverlayDidRegistryService,
    type CreateDidRequest, type CreateDidResponse,
    type UpdateDidRequest, type UpdateDidResponse,
    type SignerFunction, type UtxoProviderFunction, type ChangeAddressProviderFunction
} from '@quarkid/did-registry';
import { type DIDDocument } from '@quarkid/did-core';

export interface FrontendDidServiceConfig {
    walletClient: ToolboxWallet; // Changed from @bsv/sdk WalletClient
    topic: 'qdid'; // Set to 'qdid' as per your confirmation
    overlayProviderUrl: string; // URL for Paquetes-NPMjs/quarkid-bsv-overlay
    feePerKb?: number;
    defaultFundingPublicKeyHex?: string;
}

export class FrontendDidService {
    private walletClient: ToolboxWallet; // Changed from @bsv/sdk WalletClient
    private bsvOverlayRegistryService: BsvOverlayDidRegistryService;
    private overlayProviderUrl: string;
    private topic: 'qdid';

    constructor(config: FrontendDidServiceConfig) {
        this.walletClient = config.walletClient;
        this.overlayProviderUrl = config.overlayProviderUrl;
        this.topic = config.topic;

        const signer: SignerFunction = async (tx, inputIndex, lockingScript, satoshis, publicKeyHex) => {
            const publicKey = PublicKey.fromString(publicKeyHex);
            // The WalletClient from wallets.ts wraps a Wallet instance which has the keyDeriver
            const privateKey = this.walletClient.keyDeriver.privateKeyForPublicKey(publicKey);
            if (!privateKey) throw new Error('Private key not found for public key: ' + publicKeyHex);
            tx.sign(privateKey, inputIndex, lockingScript, satoshis);
            if (!tx.inputs[inputIndex].unlockingScript) {
                throw new Error(`Failed to generate unlocking script for input ${inputIndex}`);
            }
            return tx.inputs[inputIndex].unlockingScript as UnlockingScript;
        };

        const utxoProvider: UtxoProviderFunction = async (amount, fundingKeyHex) => {
            // The WalletClient from wallets.ts wraps a Wallet instance which has getUtxos
            const allUtxos = await this.walletClient.getUtxos({ amount });

            if (!fundingKeyHex) return allUtxos;

            // Filter UTXOs if fundingKeyHex is provided.
            return allUtxos.filter(utxo => {
                try {
                    const pk = PublicKey.fromString(fundingKeyHex);
                    // Assuming P2PKH UTXOs for simplicity in this filter
                    const addressString = pk.toAddress(); // Get address string from PublicKey
                    const expectedLockingScript = Script.fromAddress(addressString);
                    return utxo.script.toHex() === expectedLockingScript.toHex();
                } catch (e) {
                    console.error("Error filtering UTXO by fundingKeyHex", fundingKeyHex, e);
                    return false;
                }
            });
        };

        const changeAddressProvider: ChangeAddressProviderFunction = async (publicKeyHex) => {
            // The WalletClient from wallets.ts wraps a Wallet instance which has getNextChangeAddress
            const address = await this.walletClient.getNextChangeAddress();
            return address.getLockingScript().toHex();
        };

        this.bsvOverlayRegistryService = new BsvOverlayDidRegistryService({
            topic: this.topic,
            overlayProviderUrl: this.overlayProviderUrl, // BsvOverlayDidRegistryService sends tx here
            signer,
            utxoProvider,
            changeAddressProvider,
            feePerKb: config.feePerKb,
            defaultFundingPublicKeyHex: config.defaultFundingPublicKeyHex
        });
    }

    async createDID(request: CreateDidRequest): Promise<CreateDidResponse> {
        // Ensure the request topic matches the service's configured topic
        if (request.topic && request.topic !== this.topic) {
            throw new Error(`Requested topic '${request.topic}' does not match service topic '${this.topic}'`);
        }
        const reqWithTopic = { ...request, topic: this.topic };
        return this.bsvOverlayRegistryService.createDID(reqWithTopic);
    }

    async updateDID(request: UpdateDidRequest): Promise<UpdateDidResponse> {
        return this.bsvOverlayRegistryService.updateDID(request);
    }

    async resolveDID(did: string): Promise<DIDDocument | null> {
        // Example: did:bsv:qdid:txid:vout
        const didParts = did.split(':');
        if (didParts.length < 4 || didParts[0] !== 'did' || didParts[1] !== 'bsv' || didParts[2] !== this.topic) {
            console.error(`Invalid DID format or topic for resolution: ${did}`);
            return null;
        }
        // The actual resolution happens on your backend overlay service
        const resolveUrl = `${this.overlayProviderUrl}/resolve/${encodeURIComponent(did)}`;
        try {
            const response = await fetch(resolveUrl);
            if (!response.ok) {
                console.error(`Failed to resolve DID ${did} from ${resolveUrl}: ${response.status} ${response.statusText}`);
                const errorBody = await response.text();
                console.error('Error body:', errorBody);
                return null;
            }
            return await response.json() as DIDDocument;
        } catch (error) {
            console.error(`Error resolving DID ${did} from ${resolveUrl}:`, error);
            return null;
        }
    }
}

// Example Usage (commented out, to be used in your React components/contexts):
/*
import { medicalPromise } from '../context/wallets'; // Adjust path as needed

async function testDidService() {
    try {
        const walletClient = await medicalPromise;
        const didService = new FrontendDidService({
            walletClient,
            topic: 'qdid',
            overlayProviderUrl: 'YOUR_QUARKID_BSV_OVERLAY_BACKEND_URL', // IMPORTANT: Replace this!
            feePerKb: 50
        });

        // Example: Create a DID
        const initialPublicKey = walletClient.wallet.keyDeriver.deriveChild('m/0/0').publicKey;
        const createRequest: CreateDidRequest = {
            didDocument: {
                '@context': 'https://www.w3.org/ns/did/v1',
                id: `did:bsv:qdid:placeholder_txid:0`, // Placeholder, will be replaced by service
                verificationMethod: [{
                    id: '#key-1',
                    type: 'EcdsaSecp256k1VerificationKey2019',
                    controller: `did:bsv:qdid:placeholder_txid:0`, // Placeholder
                    publicKeyHex: initialPublicKey.toString()
                }],
                authentication: ['#key-1'],
                assertionMethod: ['#key-1']
            },
            initialFundingPublicKeyHex: initialPublicKey.toString(),
            topic: 'qdid' // Ensure topic is passed if BsvOverlayDidRegistryService expects it directly
        };

        console.log('Attempting to create DID...');
        const createResponse = await didService.createDID(createRequest);
        console.log('Create DID Response:', createResponse);
        console.log('New DID:', createResponse.did);

        // Example: Resolve the created DID
        if (createResponse.did) {
            console.log(`Attempting to resolve DID: ${createResponse.did}`);
            const resolvedDocument = await didService.resolveDID(createResponse.did);
            console.log('Resolved DID Document:', resolvedDocument);
        }

    } catch (error) {
        console.error('Error in DID service test:', error);
    }
}

testDidService();
*/
