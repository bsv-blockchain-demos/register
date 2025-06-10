// src/services/walletService.ts
import {
  Script,
  OP,
  WalletClient,
  type CreateActionArgs,
  type CreateActionResult,
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
    didDocumentUri: string
  ): Promise<string> {
    try {
      // 1. Create OP_RETURN script with DID URI
      const didDataBuffer = Buffer.from(didDocumentUri, 'utf8');
      
      // Create OP_RETURN script directly using Script class
      const opReturnScript = new Script();
      opReturnScript.writeOpCode(OP.OP_FALSE);
      opReturnScript.writeOpCode(OP.OP_RETURN);
      opReturnScript.writeBin(Array.from(didDataBuffer));

      // 2. Define the transaction outputs for createAction
      const outputsForAction = [
        {
          lockingScript: opReturnScript.toHex(),
          satoshis: 0,
          outputDescription: 'DID Document URI'
        },
      ];

      // 3. Create the action (unsigned transaction structure)
      const createActionArgs: CreateActionArgs = {
        description: 'Create DID transaction with BSV overlay URI',
        outputs: outputsForAction,
      };
      
      const createResult: CreateActionResult = await this.walletClient.createAction(createActionArgs);

      // Check if action was created successfully
      if (!createResult || !createResult.txid) {
        console.error('Failed to create action with WalletClient:', createResult);
        throw new Error('Transaction creation failed: Could not get transaction ID.');
      }

      console.log('Transaction created and signed with WalletClient. TXID:', createResult.txid);
      
      // Return the transaction ID - the wallet handles signing automatically
      return createResult.txid;

    } catch (error) {
      console.error('Error creating DID transaction with WalletClient:', error);
      throw new Error(`Transaction creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

export default WalletService;
