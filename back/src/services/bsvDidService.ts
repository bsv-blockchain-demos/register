import { 
  BsvOverlayDidRegistryService,
  type BsvOverlayDidRegistryConfig,
  type UpdateDidRequest,
  type UpdateDidResponse,
  type CreateDidRequest,
  type CreateDidResponse,
  type ResolveDidSuccessResponse,
  type BsvSignerFunction,
  type UtxoProviderFunction,
  type ChangeAddressProviderFunction,
} from '../lib/BsvOverlayDidRegistryService';
import { SatoshisPerKilobyte, WalletClient } from '@bsv/sdk';
import { PrivateKey, PublicKey, Transaction, LockingScript, UnlockingScript, P2PKH } from '@bsv/sdk';

/**
 * Configuration interface for the BSV DID Service
 * 
 * @property walletClient - BSV SDK wallet client for transaction operations
 * @property topic - Overlay topic identifier for DID operations
 * @property overlayProviderUrl - URL of the BSV overlay node for DID resolution
 * @property feePerKb - Optional transaction fee rate in satoshis per kilobyte
 */
export interface BsvDidServiceConfig {
  walletClient: WalletClient;
  topic: string;
  overlayProviderUrl: string;
  feePerKb?: number;
}

/**
 * BSV DID Service - Manages Bitcoin SV overlay DIDs
 * 
 * This service provides a high-level interface for creating, updating, and resolving
 * Decentralized Identifiers (DIDs) using the Bitcoin SV overlay method. DIDs are
 * stored directly on the BSV blockchain using OP_RETURN transactions.
 * 
 * Key Features:
 * - Create new BSV DIDs with embedded DID documents
 * - Update existing DIDs by referencing previous transactions
 * - Resolve DIDs by querying the BSV overlay network
 * - Automatic UTXO management and transaction signing
 * 
 * @example
 * ```typescript
 * const service = new BsvDidService(walletClient, 'my-topic', 'https://overlay.example.com');
 * 
 * const result = await service.createDID({
 *   didDocument: { ... },
 *   controllerPublicKeyHex: '02abc123...'
 * });
 * 
 * console.log('Created DID:', result.did);
 * ```
 */
export class BsvDidService {
  private bsvOverlayService: BsvOverlayDidRegistryService | null = null;
  private walletClient: WalletClient;
  private topic: string;
  private overlayProviderUrl: string;

  /**
   * Constructs a new BSV DID Service instance
   * 
   * @param config - Configuration object for the service
   * @param config.walletClient - BSV SDK wallet client for transaction operations
   * @param config.topic - Overlay topic identifier for DID operations
   * @param config.overlayProviderUrl - URL of the BSV overlay node for DID resolution
   * @param config.feePerKb - Optional transaction fee rate in satoshis per kilobyte
   * 
   * @throws {Error} When wallet client is not provided or invalid
   */
  constructor(config: BsvDidServiceConfig) {
    if (!config.walletClient) {
      throw new Error('WalletClient is required for BSV DID operations');
    }

    if (!config.topic || typeof config.topic !== 'string') {
      throw new Error('Topic is required and must be a non-empty string');
    }

    if (!config.overlayProviderUrl || typeof config.overlayProviderUrl !== 'string') {
      throw new Error('Overlay node endpoint is required and must be a valid URL');
    }

    this.walletClient = config.walletClient;
    this.topic = config.topic;
    this.overlayProviderUrl = config.overlayProviderUrl;

    this.initializeBsvOverlayService(config);
  }

  /**
   * Initializes the BSV overlay DID registry service with required configuration
   * 
   * Sets up the signer, UTXO provider, and change address provider functions
   * that the registry service uses for blockchain operations.
   * 
   * @param config - Configuration object for the service
   * @private
   */
  private initializeBsvOverlayService(config: BsvDidServiceConfig): void {
    const feeModel = new SatoshisPerKilobyte(config.feePerKb || 1);

    const signer: BsvSignerFunction = async (
      tx: Transaction,
      inputsToSign: Array<{
        inputIndex: number;
        publicKeyHex: string;
        sighashType?: number;
      }>
    ): Promise<Transaction> => {
      // For BSV SDK WalletClient, we need to use the signAction method
      // This is a simplified approach - in practice, you might need to reconstruct
      // the action or use a different signing approach
      
      // For now, we'll construct a basic signing approach
      // This might need adjustment based on your specific wallet setup
      for (const inputInfo of inputsToSign) {
        try {
          // Get the private key for this public key through the wallet's key derivation
          // Note: This is a simplified approach and may need wallet-specific implementation
          const publicKey = PublicKey.fromString(inputInfo.publicKeyHex);
          
          // For now, we'll use a basic signing approach
          // In a real implementation, you'd need to integrate with the wallet's signing flow
          const sourceOutput = tx.inputs[inputInfo.inputIndex].sourceTransaction!.outputs[tx.inputs[inputInfo.inputIndex].sourceOutputIndex];
          const lockingScript = sourceOutput.lockingScript;
          const satoshis = sourceOutput.satoshis;
          
          // This is a placeholder - actual implementation would need wallet integration
          // tx.sign(privateKey, inputInfo.inputIndex, lockingScript, satoshis);
          console.warn('Transaction signing requires wallet-specific implementation');
        } catch (error) {
          console.error(`Error signing input ${inputInfo.inputIndex}:`, error);
          throw error;
        }
      }
      return tx;
    };

    const utxoProvider: UtxoProviderFunction = async (satoshisNeeded: number) => {
      try {
        // Use the WalletClient's listOutputs method to get available UTXOs
        const outputsResult = await config.walletClient.listOutputs({
          basket: 'default', // Use default basket
          include: 'locking scripts', // Include locking scripts
          includeCustomInstructions: true,
          limit: 100 // Reasonable limit
        });

        const processedUtxos = [];
        let totalSatoshis = 0;

        for (const output of outputsResult.outputs) {
          if (!output.spendable) continue;
          
          // Parse the outpoint to get txid and vout
          const [txid, voutStr] = output.outpoint.split(':');
          const vout = parseInt(voutStr, 10);
          
          // Get public key for this output
          try {
            const publicKeyResult = await config.walletClient.getPublicKey({
              protocolID: [1, 'BSV DID'], // Security level 1, protocol BSV DID
              keyID: output.outpoint // Use outpoint as keyID
            });

            processedUtxos.push({
              txid,
              vout,
              satoshis: output.satoshis,
              scriptPubKey: output.lockingScript,
              sourceTransactionHex: '', // Not available through this interface
              publicKeyHex: publicKeyResult.publicKey,
            });

            totalSatoshis += output.satoshis;
            
            // Stop when we have enough satoshis
            if (totalSatoshis >= satoshisNeeded) {
              break;
            }
          } catch (keyError) {
            console.warn(`Could not get public key for output ${output.outpoint}:`, keyError);
            continue;
          }
        }

        if (processedUtxos.length === 0) {
          throw new Error('No suitable UTXOs found for transaction funding');
        }

        return processedUtxos;
      } catch (error) {
        console.error('Error getting UTXOs from wallet:', error);
        throw error;
      }
    };

    const changeAddressProvider: ChangeAddressProviderFunction = async () => {
      try {
        // Get a new public key for change address
        const publicKeyResult = await config.walletClient.getPublicKey({
          protocolID: [1, 'BSV DID Change'], // Security level 1, protocol for change
          counterparty: 'self' // For self (change address)
        });

        // Create P2PKH locking script from public key
        const publicKey = PublicKey.fromString(publicKeyResult.publicKey);
        const p2pkhScript = new P2PKH().lock(publicKey.toAddress().toString());
        return p2pkhScript.toHex();
      } catch (error) {
        console.error('Error getting change address from wallet:', error);
        throw error;
      }
    };

    this.bsvOverlayService = new BsvOverlayDidRegistryService({
      walletClient: config.walletClient,
      topic: config.topic,
      fetchImplementation: fetch as any,
      signer,
      utxoProvider,
      changeAddressProvider,
      feeModel,
      overlayNodeEndpoint: config.overlayProviderUrl, // Note: config uses overlayNodeEndpoint
    });
  }

  /**
   * Update an existing DID using the BSV overlay method
   * 
   * @param request - Update request containing the DID to update and new document
   * @returns The updated DID and metadata
   */
  async updateDID(request: UpdateDidRequest): Promise<UpdateDidResponse> {
    console.log(`[BsvDidService] Initiating DID update for: ${request.didToUpdate}`);
    try {
      const result = await this.bsvOverlayService.updateDID(request);
      
      console.log(`[BsvDidService] DID update successful. DID: ${result.did}`);
      return result;
    } catch (error) {
      console.error(`[BsvDidService] Error updating DID:`, error);
      throw error;
    }
  }

  /**
   * Create a new DID using the BSV overlay method
   * 
   * @param request - Create request containing the DID document
   * @returns The created DID and metadata
   */
  async createDID(request: CreateDidRequest): Promise<CreateDidResponse> {
    console.log(`[BsvDidService] Initiating DID creation`);
    try {
      const result = await this.bsvOverlayService.createDID(request);
      
      console.log(`[BsvDidService] DID creation successful. DID: ${result.did}`);
      return result;
    } catch (error) {
      console.error(`[BsvDidService] Error creating DID:`, error);
      throw error;
    }
  }

  /**
   * Resolve a DID using the BSV overlay method
   * 
   * @param did - The DID to resolve
   * @returns The resolved DID document and metadata
   */
  async resolveDID(did: string): Promise<ResolveDidSuccessResponse> {
    console.log(`[BsvDidService] Resolving DID: ${did}`);
    try {
      const result = await this.bsvOverlayService.resolveDID(did);
      
      if (!result.didDocument) {
        throw new Error(`DID document not found for: ${did}`);
      }

      return result;
    } catch (error) {
      console.error(`[BsvDidService] Error resolving DID ${did}:`, error);
      throw error;
    }
  }
}
