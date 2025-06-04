// src/services/walletService.ts
// src/services/walletService.ts
import { CWIStyleWalletManager } from '@bsv/wallet-toolbox-client';
import { P2PKH, PublicKey } from '@bsv/sdk';
import { hash160 } from '@bsv/sdk/primitives/Hash';

const MIN_SATOSHIS = 1; // Minimum satoshis for the state UTXO

class WalletService {
  private client: CWIStyleWalletManager;
  private initializationPromise: Promise<void>;

  constructor() {
    this.client = new CWIStyleWalletManager();
    console.log('CWIStyleWalletManager attempting to initialize and authenticate...');
    this.initializationPromise = this._initializeClient();
  }

  private async _initializeClient(): Promise<void> {
    try {
      // The empty object {} is passed as per the type definition for waitForAuthentication's first argument.
      const authResult = await this.client.waitForAuthentication({}, "quarkid-frontend");
      console.log('CWIStyleWalletManager authentication successful:', authResult);
      // Potentially check authResult.authenticated if needed, though waitForAuthentication should throw on failure.
    } catch (error) {
      console.error('CWIStyleWalletManager authentication failed:', error);
      // Rethrow or handle as appropriate for the application's error strategy
      throw new Error('Wallet client authentication failed.');
    }
  }

  // ... (rest of the class remains the same for now)
  async getP2PKHControllerPublicKey(): Promise<string> {
    await this.initializationPromise;
    try {
      const { publicKey } = await this.client.getPublicKey({ protocolID: [1, 'P2PKH'] /* SecurityLevel.ONE is 1 */ });
      if (!publicKey) {
        throw new Error('No public key received from Wallet Toolbox.');
      }
      return publicKey;
    } catch (error) {
      console.error('Error getting public key from Wallet Toolbox:', error);
      throw new Error('Failed to get public key. Is Wallet Toolbox running and configured?');
    }
  }

  async createAndSignDidCreationTransaction(controllerPublicKeyHex: string): Promise<string> {
    await this.initializationPromise;
    try {
      const controllerPubKey = PublicKey.fromString(controllerPublicKeyHex);
      const pubKeyBytes = controllerPubKey.encode(true); // Get compressed pubkey bytes
      const pubKeyHash = hash160(pubKeyBytes); // Hash the pubkey bytes

      const p2pkhTemplate = new P2PKH(); // Instantiate P2PKH template
      const p2pkhLockingScript = p2pkhTemplate.lock(pubKeyHash); // Create locking script
      const p2pkhScriptHex = p2pkhLockingScript.toHex(); // Get hex of locking script
      
      const createResult = await this.client.createAction({
        description: 'Create DID registration transaction',
        outputs: [{
          script: p2pkhScriptHex, 
          amount: MIN_SATOSHIS // Changed from satoshis to amount
        }]
      });

      if (!createResult || !createResult.action) {
        console.error('Failed to create action:', createResult);
        throw new Error('Transaction creation failed: Could not create action.');
      }

      // console.log('Action created:', createResult);
      // console.log('Unsigned rawTx from createAction (if available):', createResult.rawTx);

      const signResult = await this.client.signAction({ action: createResult.action });

      if (!signResult || !signResult.rawTx) {
        console.error('Failed to sign action:', signResult);
        throw new Error('Transaction signing failed.');
      }
      return signResult.rawTx;
    } catch (error) {
      console.error('Error creating/signing transaction with Wallet Toolbox:', error);
      throw new Error('Failed to create/sign transaction.');
    }
  }
}

export const walletService = new WalletService();
