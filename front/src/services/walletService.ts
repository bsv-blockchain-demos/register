// src/services/walletService.ts
import {
  Random,
  Utils,
  WalletClient,
  PublicKey,
  type CreateActionArgs,
  type CreateActionResult,
  PushDrop,
  SecurityLevels,
  type WalletProtocol,
} from '@bsv/sdk';

class WalletService {
  private walletClient: WalletClient;

  constructor(walletClient: WalletClient) {
    this.walletClient = walletClient;
    console.log('WalletService initialized with WalletClient.');
  }

  async getP2PKHControllerPublicKey(): Promise<string> {
    try {
      // Get the identity public key (root key from KeyDeriver).
      const pubKeyResult = await this.walletClient.getPublicKey({
        identityKey: true 
      });

      if (!pubKeyResult || !pubKeyResult.publicKey) {
        console.error('Failed to get public key from WalletClient:', pubKeyResult);
        throw new Error('Could not get public key from WalletClient.');
      }
      return pubKeyResult.publicKey; // This is typically a hex string
    } catch (error) {
      console.error('Error getting public key from WalletClient:', error);
      const e = error as Error;
      throw new Error(`Failed to get public key: ${e.message}`);
    }
  }

  async createAndSignDidCreationTransaction(
    didDocumentUri: string
  ): Promise<number[]> {
    try {
      // 1. Create PushDrop Script with the didDocumentUri
      const data = PublicKey.fromString(didDocumentUri).encode(true) as number[]
      const template = new PushDrop(this.walletClient, 'quarkid_did')
      const protocolID = [SecurityLevels.Silent, 'quark did'] as WalletProtocol
      const keyID = Utils.toBase64(Random(21))
      const counterparty = 'self'
      const script = await template.lock([data], protocolID, keyID, counterparty, true, true, 'before')
      
      // 2. Define the transaction outputs for createAction
      const outputsForAction = [
        {
          lockingScript: script.toHex(),
          satoshis: 1,
          outputDescription: 'DID Document URI',
          customInstructions: JSON.stringify({ // we must store this info so the user can unlock it again in future.
            protocolID,
            counterparty,
            keyID
          })
        },
      ];

      // 3. Create the action (unsigned transaction structure)
      const createActionArgs: CreateActionArgs = {
        description: 'Create DID transaction with BSV overlay',
        outputs: outputsForAction,
        options: {
          randomizeOutputs: false
        }
      };
      
      const createResult: CreateActionResult = await this.walletClient.createAction(createActionArgs);

      // Check if action was created successfully
      if (!createResult || !createResult.txid) {
        console.error('Failed to create action with WalletClient:', createResult);
        throw new Error('Transaction creation failed: Could not get transaction ID.');
      }

      console.log('Transaction created and signed with WalletClient. TXID:', createResult.txid);
      
      // Return the transaction atomicBEEF - the wallet handles signing automatically
      return createResult.tx!;
    } catch (error) {
      console.error('Error creating DID transaction with WalletClient:', error);
      throw new Error(`Transaction creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

export default WalletService;
