// src/services/walletService.ts
import {
  PushDrop,
  WalletClient,
  type CreateActionArgs,
  type CreateActionResult,
  type SignActionArgs,
  type SignActionResult,
} from '@bsv/sdk';
import { Buffer } from 'buffer'; // Corrected import path

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
    didDocumentUri: string // e.g., "did:bsv-overlay:02xxxxxxxx..."
  ): Promise<string> {
    try {
      // 1. Create OP_RETURN script with DID URI using PushDrop
      const didDataBuffer = Buffer.from(didDocumentUri, 'utf8');
      const opReturnLockingScript = await new PushDrop().lock([didDataBuffer]);

      // 2. Define the transaction outputs for createAction
      const outputsForAction = [
        {
          lockingScript: opReturnLockingScript.toHex(), // Corrected: script -> lockingScript
          satoshis: 0, // Corrected: amount -> satoshis. OP_RETURN outputs carry 0 satoshis
          // outputDescription: 'DID URI' // Optional description
        },
      ];

      // 3. Create the action (unsigned transaction structure)
      const createActionArgs: CreateActionArgs = {
        description: 'Create DID transaction with bsv-overlay URI',
        outputs: outputsForAction,
        // feePerByte: 0.05, // Optional: configure fee rate, or let wallet use its default.
        // autoProcess: false, // Set to false if you explicitly want to call signAction
      };
      const createResult: CreateActionResult = await this.walletClient.createAction(createActionArgs);

      // Tentatively using 'actionIdentifier' based on lint feedback pattern
      if (!createResult || !createResult.actionIdentifier) {
        console.error('Failed to create action with WalletClient:', createResult);
        throw new Error('Transaction creation (action) failed: Could not get action identifier.');
      }

      // If createAction returns rawTx and it's already signed (e.g. if autoProcess was true or default),
      // you might be able to use it directly. However, the standard flow is to sign explicitly.
      // Forcing signAction for clarity and control here.

      // 4. Sign the action
      const signActionArgs: SignActionArgs = {
        actionIdentifier: createResult.actionIdentifier, // Tentatively using 'actionIdentifier'
      };
      const signResult: SignActionResult = await this.walletClient.signAction(signActionArgs);

      // Tentatively using 'transactionHex' based on lint feedback pattern
      if (!signResult || !signResult.transactionHex) {
        console.error('Failed to sign action with WalletClient:', signResult);
        throw new Error('Transaction signing failed: Could not get rawTx.');
      }

      console.log('Transaction created and signed with WalletClient. TXID:', signResult.txid);
      return signResult.transactionHex; // Tentatively using 'transactionHex'

    } catch (error) {
      console.error('Error creating/signing DID transaction with WalletClient:', error);
      const e = error as Error;
      throw new Error(`Transaction operation failed: ${e.message}`);
    }
  }
}

export default WalletService;
