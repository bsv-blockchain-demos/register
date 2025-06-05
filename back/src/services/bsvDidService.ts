import {
  BsvOverlayDidRegistryService,
  type UpdateDidRequest,
  type UpdateDidResponse,
  type BsvSignerFunction,
  type UtxoProviderFunction,
  type ChangeAddressProviderFunction,
  SatoshisPerKilobyte,
  type CreateDidRequest, // Added for completeness, if you want to add createDID later
  type CreateDidResponse // Added for completeness
} from '@quarkid/did-registry';
// WalletClient from @bsv/sdk will be used directly for typing
// import { type WalletClient as ToolboxWalletClient } from '@bsv/wallet-toolbox-client'; 
import {
  Transaction,
  LockingScript,
  UnlockingScript,
  P2PKH,
  PublicKey,
  PrivateKey
} from '@bsv/sdk';
import fetch from 'node-fetch'; // Assuming node-fetch is needed if global fetch isn't sufficient

// Configuration interface for the service
import { type Wallet } from '@bsv/wallet-toolbox-client'; // Correctly import Wallet

// Configuration interface for the service
export interface BsvDidServiceConfig {
  walletClient: Wallet; // Use Wallet from @bsv/wallet-toolbox-client
  topic: string;
  overlayProviderUrl: string;
  feePerKb?: number;
  defaultFundingPublicKeyHex?: string; // Optional: if funding usually comes from a specific key
}

export class BsvDidService {
  private bsvOverlayRegistryService: BsvOverlayDidRegistryService;
  private walletClient: Wallet;
  private defaultFundingPublicKeyHex?: string;

  constructor(config: BsvDidServiceConfig) {
    this.walletClient = config.walletClient;
    this.defaultFundingPublicKeyHex = config.defaultFundingPublicKeyHex;

    const feeModel = new SatoshisPerKilobyte(config.feePerKb || 50);

    const signer: BsvSignerFunction = async (
      tx: Transaction,
      inputIndex: number,
      lockingScript: LockingScript, // This is the script being spent
      satoshis: number,
      publicKeyHex?: string // Crucial: Use this to get the correct private key
    ): Promise<UnlockingScript> => {
      if (!publicKeyHex) {
        throw new Error('publicKeyHex is required for signing with WalletClient');
      }
      // The BsvOverlayDidRegistryService signs the BRC-48 input itself with the controller key.
      // This signer is for *funding* inputs, using keys managed by the WalletClient.
      const pkToUse = PublicKey.fromString(publicKeyHex);
      // Assuming keyDeriver is accessible like this. Adjust if your WalletClient structure differs.
      const privateKey = await this.walletClient.keyDeriver.privateKeyForPublicKey(pkToUse);
      if (!privateKey) {
        throw new Error(`Could not derive private key for public key: ${publicKeyHex}`);
      }
      // The sign method in @bsv/sdk's Transaction class might automatically create the unlocking script.
      // Or, you might need to construct it manually after signing.
      // For now, assuming tx.sign populates it or returns what's needed.
      await (tx.sign as any)(privateKey, inputIndex, lockingScript, satoshis); // Cast to any to bypass signature mismatch
      if (!tx.inputs[inputIndex].unlockingScript) {
        throw new Error(`Failed to generate unlocking script for input ${inputIndex}`);
      }
      return tx.inputs[inputIndex].unlockingScript as UnlockingScript;
    };

    const utxoProvider: UtxoProviderFunction = async (amount?: number, desiredPublicKeyHex?: string) => {
      const fundingKeyHex = desiredPublicKeyHex || this.defaultFundingPublicKeyHex;
      // WalletClient.getUtxos() might not directly filter by publicKeyHex or return it.
      // We need to ensure the UTXOs returned can be associated with a publicKeyHex for the signer.
      const utxosFromWallet = await this.walletClient.getUtxos({ amount }); // Adjust params as needed
      const processedUtxos = [];

      for (const utxo of utxosFromWallet) {
        // Attempt to derive/find the public key for this UTXO's locking script (P2PKH)
        const pkhBuffer = utxo.lockingScript.getPublicKeyHash();
        if (!pkhBuffer) {
            console.warn(`UTXO ${utxo.txid}:${utxo.vout} is not a P2PKH, skipping.`);
            continue;
        }
        // Assuming keyDeriver is accessible. Adjust path if needed.
        const associatedPublicKey = await this.walletClient.keyDeriver.publicKeyForPublicKeyHash(pkhBuffer);

        if (associatedPublicKey) {
          const currentUtxoPublicKeyHex = associatedPublicKey.toString();
          // If a specific fundingKeyHex is requested, only use UTXOs from that key.
          if (fundingKeyHex && currentUtxoPublicKeyHex !== fundingKeyHex) {
            continue;
          }
          processedUtxos.push({
            txid: utxo.txid,
            vout: utxo.vout,
            satoshis: utxo.satoshis,
            lockingScript: utxo.lockingScript.toHex(),
            publicKeyHex: currentUtxoPublicKeyHex, // Crucial: full public key hex
          });
        } else {
          console.warn(`Could not find public key for UTXO: ${utxo.txid}:${utxo.vout}`);
        }
      }

      if (processedUtxos.length === 0 && amount && amount > 0) {
        throw new Error('Insufficient funds or unable to associate public keys with UTXOs for the required funding key.');
      }
      return processedUtxos;
    };

    const changeAddressProvider: ChangeAddressProviderFunction = async (publicKeyHex?: string) => {
      // If publicKeyHex is provided, change should ideally go to an address from that key.
      // Otherwise, use the wallet's default. WalletClient.getNextChangeAddress may not use publicKeyHex.
      const changeAddressString = await this.walletClient.getNextChangeAddress({}); // Pass options as per SDK
      const p2pkhScript = LockingScript.fromAddress(changeAddressString);
      return p2pkhScript.toHex();
    };

    this.bsvOverlayRegistryService = new BsvOverlayDidRegistryService({
      topic: config.topic,
      fetch: fetch as any, // Cast to 'any' if type mismatch with global fetch
      signer,
      utxoProvider,
      changeAddressProvider,
      feeModel,
      overlayProviderUrl: config.overlayProviderUrl,
    });
  }

  async updateDID(request: UpdateDidRequest): Promise<UpdateDidResponse> {
    console.log(`[BsvDidService] Initiating DID update for: ${request.didToUpdate}`);
    try {
      const response = await this.bsvOverlayRegistryService.updateDID(request);
      console.log(`[BsvDidService] DID update successful. New DID: ${response.did}`);
      return response;
    } catch (error) {
      console.error('[BsvDidService] Error updating DID:', error);
      throw error;
    }
  }
  
  // Optional: Add createDID if needed in the future
  /*
  async createDID(request: CreateDidRequest): Promise<CreateDidResponse> {
    console.log(`[BsvDidService] Initiating DID creation for topic: ${this.bsvOverlayRegistryService.config.topic}`);
    try {
      const response = await this.bsvOverlayRegistryService.createDID(request);
      console.log(`[BsvDidService] DID creation successful. DID: ${response.did}`);
      return response;
    } catch (error) {
      console.error('[BsvDidService] Error creating DID:', error);
      throw error;
    }
  }
  */
}
