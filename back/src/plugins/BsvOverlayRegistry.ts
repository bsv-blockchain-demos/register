import { DIDDocument } from '@quarkid/did-core';
import { WalletClient, CreateActionArgs, CreateActionResult, Utils, PushDrop, SecurityLevels, WalletProtocol, Random } from '@bsv/sdk';

/**
 * BSV Overlay Registry for QuarkID Agent
 * 
 * This class implements the DID Registry interface using BSV overlays
 * through the BRC-100 WalletClient. All transaction creation and signing
 * is handled by the user's Metanet desktop wallet.
 * 
 * Key improvements over custom implementation:
 * - Uses standard BRC-100 action protocol
 * - No private key handling in backend
 * - User approves all transactions in wallet
 * - Automatic UTXO management by wallet
 * - Compatible with QuarkID Agent patterns
 */
export class BsvOverlayRegistry {
  private walletClient: WalletClient;
  private topic: string;
  private overlayProvider: string;

  constructor(
    walletClient: WalletClient,
    topic: string,
    overlayProvider: string
  ) {
    this.walletClient = walletClient;
    this.topic = topic;
    this.overlayProvider = overlayProvider;
    console.log('[BsvOverlayRegistry] Initialized with:', {
      hasWalletClient: !!walletClient,
      walletClientType: typeof walletClient,
      topic,
      overlayProvider
    });
  }

  /**
   * Create a new DID on BSV overlay
   * Uses BRC-100 createAction to request wallet to create the transaction
   */
  async createDID(didDocument: DIDDocument): Promise<{ did: string; txid: string }> {
    console.log('[BsvOverlayRegistry] createDID called with document:', JSON.stringify(didDocument, null, 2));
    
    if (!this.walletClient) {
      throw new Error('WalletClient not initialized');
    }
    
    // Prepare the DID document data for storage
    const didData = {
      ...didDocument,
      created: new Date().toISOString(),
      '@context': didDocument['@context'] || ['https://www.w3.org/ns/did/v1']
    };
    
    console.log('[BsvOverlayRegistry] Preparing BRC-100 CreateAction...');
    
    // Prepare the DID document for storage
    const didDocumentString = JSON.stringify(didData);
    
    const data = Utils.toArray(didDocumentString, 'utf8')
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
        basket: 'quarkid',
        customInstructions: JSON.stringify({ // we must store this info so the user can unlock it again in future.
          protocolID,
          counterparty,
          keyID
        })
      },
    ];

    // BRC-100 standard labels
    const labels = ['quarkid', 'did', 'create'];

    // 3. Create the action (unsigned transaction structure)
    const createActionArgs: CreateActionArgs = {
      description: 'Create DID transaction with BSV overlay',
      outputs: outputsForAction,
      options: {
        randomizeOutputs: false,
      },
      labels
    };
      

    try {
      console.log('[BsvOverlayRegistry] Calling walletClient.createAction...');
      // Request wallet to create and sign the transaction
      const result: CreateActionResult = await this.walletClient.createAction(createActionArgs);
      
      console.log('[BsvOverlayRegistry] CreateAction result:', result);
      
      if (!result.txid) {
        throw new Error('Wallet did not return transaction ID');
      }
      
      // The wallet has already broadcast the transaction
      // Extract the DID from the transaction details
      const vout = 1; // The P2PKH output is at index 1
      const did = `did:bsv:${this.topic}:${result.txid}:${vout}`;
      
      console.log(`[BsvOverlayRegistry] DID created: ${did}`);
      
      // Optionally notify the overlay provider about the new DID
      // This helps with indexing and faster lookups
      if (this.overlayProvider) {
        try {
          console.log("[aegkjhbgfsdkjhbsdfvkjhdfs] Notifying overlay provider...")
          await this.notifyOverlayProvider('tm_did', result.tx);
        } catch (error) {
          console.warn('[BsvOverlayRegistry] Failed to notify overlay provider:', error);
          // Non-critical error, DID is still created on-chain
        }
      }
      
      return { did, txid: result.txid };
      
    } catch (error) {
      console.error('[BsvOverlayRegistry] Error creating DID:', error);
      throw new Error(`Failed to create DID: ${error.message}`);
    }
  }

  /**
   * Resolve a DID from BSV overlay
   * Uses standard BRC-24 lookup service
   */
  async resolveDID(did: string): Promise<DIDDocument | null> {
    // Parse the DID
    const parts = did.split(':');
    if (parts.length !== 5 || parts[0] !== 'did' || parts[1] !== 'bsv') {
      throw new Error('Invalid BSV DID format');
    }
    
    const topic = parts[2];
    const txid = parts[3];
    const vout = parts[4];
    
    // Query the overlay provider (BRC-24 compliant endpoint)
    const url = `${this.overlayProvider}/lookup/${topic}/${txid}/${vout}`;
    
    try {
      const response = await fetch(url);
      if (!response.ok) {
        if (response.status === 404) {
          return null;
        }
        throw new Error(`Overlay provider error: ${response.status}`);
      }
      
      const data = await response.json();
      return data.didDocument;
      
    } catch (error) {
      console.error('[BsvOverlayRegistry] Error resolving DID:', error);
      throw new Error(`Failed to resolve DID: ${error.message}`);
    }
  }

  /**
   * Update an existing DID
   * Uses BRC-100 createAction with reference to previous DID
   */
  async updateDID(
    did: string, 
    newDidDocument: DIDDocument
  ): Promise<{ did: string; txid: string }> {
    console.log('[BsvOverlayRegistry] Updating DID via BRC-100 WalletClient...');
    
    // Parse existing DID
    const parts = did.split(':');
    if (parts.length !== 5) {
      throw new Error('Invalid DID format');
    }
    
    const previousTxid = parts[3];
    const previousVout = parseInt(parts[4]);
    
    // Create update action
    const updateActionArgs: CreateActionArgs = {
      description: `Update DID on BSV overlay (topic: ${this.topic})`,
      
      // Reference the previous DID output as input
      inputs: [{
        outpoint: `${previousTxid}:${previousVout}`,
        inputDescription: 'Previous DID output',
        // Wallet will provide the unlocking script
      }],
      
      outputs: [
        {
          // Updated DID document
          lockingScript: this.buildOpReturnScript(this.topic, 'UPDATE', previousTxid, String(previousVout), JSON.stringify(newDidDocument)),
          satoshis: 0,
          outputDescription: 'Updated DID Document'
        },
        {
          // New identifier output
          lockingScript: '76a914' + '00'.repeat(20) + '88ac',
          satoshis: 1000,
          outputDescription: 'Updated DID identifier',
          customInstructions: JSON.stringify({
            keyDerivation: {
              purpose: 'did-identifier',
              counterparty: 'self'
            }
          })
        }
      ],
      
      labels: ['quarkid', 'did', 'update']
    };
    
    try {
      const result = await this.walletClient.createAction(updateActionArgs);
      
      const newDid = `did:bsv:${this.topic}:${result.txid}:1`;
      
      return { did: newDid, txid: result.txid };
      
    } catch (error) {
      console.error('[BsvOverlayRegistry] Error updating DID:', error);
      throw error;
    }
  }

  /**
   * Notify overlay provider about new transaction
   * This helps with faster indexing (BRC-22 submission)
   */
  private async notifyOverlayProvider(topic: string, beef: number[]): Promise<void> {
    const url = `${this.overlayProvider}/submit`;

    await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        'X-Topics': JSON.stringify([topic])
      },
      body: new Uint8Array(beef)
    });
  }
  
  /**
   * Build OP_RETURN script as hex string
   */
  private buildOpReturnScript(...data: string[]): string {
    // OP_FALSE (0x00) OP_RETURN (0x6a)
    let script = '006a';
    
    for (const item of data) {
      const bytes = Buffer.from(item, 'utf8');
      const len = bytes.length;
      
      if (len <= 75) {
        // Push data with single byte length
        script += len.toString(16).padStart(2, '0');
      } else if (len <= 255) {
        // OP_PUSHDATA1
        script += '4c' + len.toString(16).padStart(2, '0');
      } else if (len <= 65535) {
        // OP_PUSHDATA2
        const lenHex = len.toString(16).padStart(4, '0');
        script += '4d' + lenHex.slice(2, 4) + lenHex.slice(0, 2);
      } else {
        throw new Error('Data too large for OP_RETURN');
      }
      
      script += bytes.toString('hex');
    }
    
    return script;
  }
}
