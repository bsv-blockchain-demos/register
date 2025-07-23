import { DIDDocument, VerificationMethodTypes } from '@quarkid/did-core';
import { 
  WalletClient, 
  CreateActionArgs, 
  CreateActionResult, 
  WalletProtocol,
  SecurityLevels,
  PushDrop,
  Hash,
  Utils,
  Transaction,
  Script, 
  KeyDeriver,
  PrivateKey,
  Byte,
  Beef,
  AtomicBEEF,
  ATOMIC_BEEF,
  TopicBroadcaster,
  BeefTx,
  HTTPSOverlayBroadcastFacilitator,
  TaggedBEEF
} from '@bsv/sdk';
import { Services, Setup, SetupWallet, StorageClient, wait, Wallet, WalletStorageManager } from '@bsv/wallet-toolbox';
import { IJWK } from '@quarkid/kms-core';
import { BsvWalletKMS } from './BsvWalletKMS';
import { appConfig } from '../config/AppConfig';
import { Db } from 'mongodb';

// TOP-LEVEL DEBUG: Verify file is being loaded fresh
console.log('[BsvOverlayRegistry] ===== FILE LOADED ===== at', new Date().toISOString());
console.log('[BsvOverlayRegistry] This log should appear when the server starts if tsx is loading this file fresh.');

/**
 * BSV Overlay Registry for QuarkID Agent
 * 
 * This class implements the DID Registry interface using BSV overlays
 * through the BRC-100 WalletClient. All transaction creation and signing
 * is handled by the user's Metanet desktop wallet.
 * 
 * Key Features:
 * - Creates DID documents with PushDrop format in OP_RETURN outputs
 * - Stores DID metadata in customInstructions for retrieval
 * - Integrates with BSV overlay network for DID resolution
 * - Works with WalletClient for transaction funding and signing
 */
export class BsvOverlayRegistry {
  private walletClient: WalletClient;
  private kms: BsvWalletKMS;
  private topic: string;
  private overlayProvider: string;
  private db: Db | null;



  constructor(
    kms: BsvWalletKMS,
    topic: string,
    overlayProvider: string,
    db?: Db | null
  ) {
    console.log('[BsvOverlayRegistry] Constructor called with:');
    console.log('[BsvOverlayRegistry] - kms:', !!kms);
    console.log('[BsvOverlayRegistry] - topic:', topic);
    console.log('[BsvOverlayRegistry] - overlayProvider:', overlayProvider);
    console.log('[BsvOverlayRegistry] - db:', !!db);
    console.log('[BsvOverlayRegistry] CONSTRUCTOR v2 WITH LOGGING');
    this.kms = kms;
    this.topic = topic;
    this.overlayProvider = overlayProvider;
    this.db = db || null;
  }


  async createWalletClient(): Promise<WalletClient> {
    const rootKey = PrivateKey.fromHex(appConfig.platformFundingKey)
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
    const client = new StorageClient(wallet, appConfig.walletStorageUrl)
    await storage.addWalletStorageProvider(client)
    await storage.makeAvailable()
    return new WalletClient(wallet)
}

  /**
   * Create a new DID on BSV overlay
   * Uses BRC-100 createAction to request wallet to create the transaction
   */
  async createDID(options: { didDocument: DIDDocument; publicKeyJWK?: IJWK; keyId?: string }): Promise<{ did: string; car: CreateActionResult; didDocument: DIDDocument }> {
    console.log('[BsvOverlayRegistry] ========== createDID ENTRY ==========');
    console.log('[BsvOverlayRegistry] Method called at:', new Date().toISOString());
    console.log('[BsvOverlayRegistry] Options provided:', !!options);
    
    console.log('[BsvOverlayRegistry] Wallet client available:', !!this.walletClient);

    this.walletClient = await this.createWalletClient();
    
    try {
      console.log('[BsvOverlayRegistry] Inside try block - extracting options...');
      const { didDocument, publicKeyJWK, keyId } = options;
      console.log('[BsvOverlayRegistry] createDID called with document:', JSON.stringify(didDocument, null, 2));
      console.log('[BsvOverlayRegistry] publicKeyJWK provided:', !!publicKeyJWK);
      console.log('[BsvOverlayRegistry] keyId provided:', keyId);
      
      if (!this.walletClient) {
        console.error('[BsvOverlayRegistry] ERROR: WalletClient not initialized');
        throw new Error('WalletClient not initialized');
      }
      
      console.log('[BsvOverlayRegistry] About to generate serial number...');
      // We need to create the DID first to know the identifier
      // So we'll create a temporary document, get the txid, then update it
      const tempDoc = {
        ...didDocument,
        '@context': didDocument['@context'] || ['https://www.w3.org/ns/did/v1']
      };
      
      console.log('[BsvOverlayRegistry] Preparing BRC-100 CreateAction...');
      
      // Create the serialNumber and fields for PushDrop
      // Add timestamp and random value to ensure uniqueness
      const uniqueData = {
        ...didDocument,
        timestamp: Date.now(),
        nonce: Math.random().toString(36).substring(2, 15)
      };
      const serialNumberBytes = Hash.sha256(JSON.stringify(uniqueData));
      const serialNumber = Utils.toHex(serialNumberBytes); // Convert to hex string for consistent use
      
      // Create the DID using serialNumber instead of txid:vout
      const did = `did:bsv:${this.topic}:${serialNumber}`;
      
      console.log('[BsvOverlayRegistry] Generated unique DID:', did);
      
      // Protocol ID for DID tokens - should match LARS topic
      const protocolID: WalletProtocol = [0, 'tm did'];
      const keyID: string = did; // Use the full DID as keyID since we have complete document on-chain
      const counterparty: string = 'self';
      
      // Now construct the final DID document with the correct ID and verification method
      const finalDidDocument: DIDDocument = {
        ...didDocument,
        id: did,
        '@context': didDocument['@context'] || ['https://www.w3.org/ns/did/v1'],
        verificationMethod: [],
        authentication: [],
        assertionMethod: [],
        keyAgreement: [],
        capabilityDelegation: [],
        capabilityInvocation: []
      };
      
      // Add verification method if public key is provided
      if (publicKeyJWK && keyId) {
        console.log('[BsvOverlayRegistry] Adding verification method with provided key...');
        const verificationMethod = {
          id: keyId,
          type: VerificationMethodTypes.JsonWebKey2020,
          controller: did,
          publicKeyJwk: publicKeyJWK
        };
        
        finalDidDocument.verificationMethod = [verificationMethod];
        finalDidDocument.authentication = [keyId];
        finalDidDocument.assertionMethod = [keyId];
        console.log('[BsvOverlayRegistry] Verification method added');
      } else if (publicKeyJWK) {
        // Fallback to default if keyId not provided
        const verificationMethod = {
          id: `${did}#key-1`,
          type: VerificationMethodTypes.JsonWebKey2020,
          controller: did,
          publicKeyJwk: publicKeyJWK
        };
        
        finalDidDocument.verificationMethod = [verificationMethod];
        finalDidDocument.authentication = [`${did}#key-1`];
        finalDidDocument.assertionMethod = [`${did}#key-1`];
        console.log('[BsvOverlayRegistry] Added verification method with default key-1');
      }

      // Now that we have the final DID document, create the PushDrop fields
      // DID topic manager now accepts the full DID document as JSON
      const binaryFinalDidDocument: Byte[] = Utils.toArray(JSON.stringify(finalDidDocument), "utf8") as Byte[];
      const fields: Byte[][] = [
        binaryFinalDidDocument   // Full DID document as JSON - overlay now accepts variable length
      ];

      // Create the PushDrop locking script args with properly initialized fields
      const args = {
        fields: fields,
        protocolID: protocolID,
        keyID: keyID,
        counterparty: counterparty,
        includeSignature: true,  // LARS expects a signature as the second field
        lockPosition: 'before',
        forSelf: true
      };

      console.log('[BsvOverlayRegistry] Creating PushDrop instance...');
      const pushDropToken = new PushDrop(this.walletClient)

      console.log('[BsvOverlayRegistry] Calling pushDropToken.lock...');
      const lock = await pushDropToken.lock(
        args.fields,
        args.protocolID,
        args.keyID,
        args.counterparty,
        args.forSelf,
        args.includeSignature,
        args.lockPosition as "before" | "after"
      );

      console.log('[BsvOverlayRegistry] Lock created, converting to hex...');
      const lockingScript = lock.toHex();
      
      console.log('[BsvOverlayRegistry] Creating action with wallet client...');
      // Create the transaction with the PushDrop output
      const car = await this.walletClient.createAction({
        description: 'Create DID transaction with BSV overlay',
        outputs: [
          {
            satoshis: 1,
            lockingScript: lockingScript,
            outputDescription: 'DID PushDrop Token',
            basket: 'bsv-did',
            customInstructions: JSON.stringify({
              protocolID: args.protocolID,
              counterparty: args.counterparty,
              keyID: args.keyID,
              type: 'PushDrop'
              // Removed didDocument and fields to reduce size - they're already in the lockingScript
            })
          }
        ],
        options: {
          randomizeOutputs: false,
        },
        labels: ['bsv-did', 'create']
      });
      
      console.log('[BsvOverlayRegistry] CreateActionResult obtained:', !!car);
      console.log('[BsvOverlayRegistry] car.txid:', car.txid);
      console.log('[BsvOverlayRegistry] car.tx exists:', !!car.tx);
      console.log('[BsvOverlayRegistry] car.tx type:', typeof car.tx);
      console.log('[BsvOverlayRegistry] car.tx is array:', Array.isArray(car.tx));
      console.log('[BsvOverlayRegistry] car.tx length:', car.tx ? car.tx.length : 'N/A');
      
      const beef: AtomicBEEF = car.tx;
      const vout = `${car.txid}.0`;
      console.log(`[BsvOverlayRegistry] DID created: ${did}`);

      // Store minimal lookup data in MongoDB - DID document is now fully on-chain
      // NOTE: MongoDB only stores txid/vout mapping since full DID document is in PushDrop fields
      if (this.db) {
        console.log('[BsvOverlayRegistry] Storing minimal DID lookup in MongoDB...');
        try {
          const lookupData = {
            serialNumber,
            txid: car.txid,
            vout: 0, // The DID is in output 0
            topic: this.topic,
            // didDocument removed - now stored fully on-chain in PushDrop fields
            createdAt: new Date()
          };
          
          console.log('[BsvOverlayRegistry] Storing DID lookup data in MongoDB:', lookupData);
          await this.db.collection('did_lookups').insertOne(lookupData);
          console.log('[BsvOverlayRegistry] Successfully stored DID lookup data');
        } catch (dbError) {
          console.error('[BsvOverlayRegistry] Error storing DID lookup in MongoDB:', dbError);
          // Non-critical error, continue
        }
      } else {
        console.log('[BsvOverlayRegistry] No MongoDB connection, skipping DID lookup storage');
      }

      console.log('[BsvOverlayRegistry] ============ LARS SUBMISSION SECTION START ============');
      try {
        console.log('[BsvOverlayRegistry] Submitting transaction to LARS overlay...');
        // Submit the transaction to LARS for indexing
        await this.notifyOverlayProvider(this.topic, beef, serialNumber, car.txid, 0);
        console.log('[BsvOverlayRegistry] Successfully submitted to LARS');
      } catch (error) {
        console.error('[BsvOverlayRegistry] Error submitting to LARS:', error);
        // Non-critical error, continue - the DID is still created on-chain
      }
      console.log('[BsvOverlayRegistry] ============ LARS SUBMISSION SECTION END ============');

      console.log('[BsvOverlayRegistry] Preparing return value...');
      const result = {
        did,
        car,
        didDocument: finalDidDocument
      };
    
      console.log('[BsvOverlayRegistry] ========== createDID EXIT - SUCCESS ==========');
      return result;
    
    } catch (error) {
      console.error('[BsvOverlayRegistry] ========== createDID ERROR ==========');
      console.error('[BsvOverlayRegistry] Error in createDID:', error);
      console.error('[BsvOverlayRegistry] Error stack:', error.stack);
      throw error;
    }
  }


  /**
   * Resolve a DID to its DID Document
   * First checks MongoDB for the DID lookup info, then queries LARS if needed
   */
  async resolveDID(did: string, car?: CreateActionResult): Promise<DIDDocument | null> {
    try {
      console.log('[BsvOverlayRegistry] Resolving DID:', did);
      
      // Parse the DID to extract the components (format: did:bsv:<topic>:<serialNumber>)
      const didParts = did.split(':');
      if (didParts.length !== 4 || didParts[0] !== 'did' || didParts[1] !== 'bsv') {
        throw new Error('Invalid DID format');
      }
      
      const topic = didParts[2];
      const serialNumber = didParts[3]; // serialNumber is now the full hex string
      
      console.log(`[BsvOverlayRegistry] Parsed DID - topic: ${topic}, serialNumber: ${serialNumber}`);
      
      // First, try to get the DID info from MongoDB
      if (this.db) {
        console.log('[BsvOverlayRegistry] Checking MongoDB for DID lookup info...');
        const didLookup = await this.db.collection('did_lookups').findOne({ serialNumber });
        
        if (didLookup) {
          console.log('[BsvOverlayRegistry] Found DID in MongoDB:', {
            txid: didLookup.txid,
            vout: didLookup.vout,
            topic: didLookup.topic
          });
          
          // If we have a stored DID document, return it
          if (didLookup.didDocument) {
            console.log('[BsvOverlayRegistry] Returning DID document from MongoDB');
            return didLookup.didDocument;
          }
          
          // Otherwise, query LARS with the serialNumber
          if (didLookup.txid && didLookup.vout !== undefined) {
            const outpoint = `${didLookup.txid}.${didLookup.vout}`;
            console.log('[BsvOverlayRegistry] Querying LARS with serialNumber:', serialNumber);
            console.log('[BsvOverlayRegistry] Outpoint for reference:', outpoint);
            
            if (!this.overlayProvider) {
              throw new Error('Overlay provider URL not configured');
            }
            
            const url = `${this.overlayProvider}/lookup`;
            console.log('[BsvOverlayRegistry] Querying LARS:', url);
            
            try {
              const response = await fetch(url, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                  service: 'ls_did',
                  query: {
                    serialNumber: serialNumber  // Use serialNumber for LARS lookup
                  }
                })
              });
              
              if (!response.ok) {
                console.error('[BsvOverlayRegistry] ERROR: Overlay provider error:', response.status);
                throw new Error(`Overlay provider error: ${response.status}`);
              }
              
              const data = await response.json();
              console.log('[BsvOverlayRegistry] LARS response keys:', Object.keys(data));
              console.log('[BsvOverlayRegistry] LARS response type:', data.type);
              console.log('[BsvOverlayRegistry] LARS response length:', JSON.stringify(data).length);
              
              // Debug: Check if data has outputs or is structured differently
              if (Array.isArray(data)) {
                console.log('[BsvOverlayRegistry] LARS returned array with length:', data.length);
                if (data.length > 0) {
                  const firstElement = data[0];
                  console.log('[BsvOverlayRegistry] First array element keys:', Object.keys(firstElement));
                  console.log('[BsvOverlayRegistry] First array element:', JSON.stringify(firstElement, null, 2));
                  
                  // Check if this element has 'beef' or transaction data
                  if (firstElement.beef) {
                    console.log('[BsvOverlayRegistry] Found BEEF data in LARS response!');
                    try {
                      // Parse the transaction from BEEF
                      const beefArray = Array.isArray(firstElement.beef) ? firstElement.beef : [firstElement.beef];
                      const tx = Transaction.fromBEEF(beefArray);
                      console.log('[BsvOverlayRegistry] Parsed transaction from BEEF:', tx.id('hex'));
                      
                      // Get the output at the specified index
                      const outputIndex = firstElement.outputIndex || 0;
                      if (!tx.outputs || tx.outputs.length <= outputIndex) {
                        throw new Error(`Transaction has no output at index ${outputIndex}`);
                      }
                      
                      const output = tx.outputs[outputIndex];
                      console.log('[BsvOverlayRegistry] Found output at index', outputIndex);
                      
                      // Decode the PushDrop to get the DID document
                      const result = PushDrop.decode(output.lockingScript);
                      if (!result.fields || result.fields.length === 0) {
                        throw new Error('PushDrop decode returned no fields');
                      }
                      
                      const didDocumentString = Utils.toUTF8(result.fields[0]);
                      const didDocument = JSON.parse(didDocumentString);
                      
                      // Validate that it's a proper DID document
                      if (!didDocument.id || !didDocument.id.startsWith('did:')) {
                        throw new Error('Invalid DID document: missing or invalid id');
                      }
                      
                      console.log('[BsvOverlayRegistry] Successfully parsed DID document from BEEF:', didDocument);
                      return didDocument;
                      
                    } catch (beefError) {
                      console.error('[BsvOverlayRegistry] Error parsing BEEF data:', beefError);
                      console.error('[BsvOverlayRegistry] BEEF parsing failed, falling through to other methods');
                    }
                  }
                }
              }
              
              // Check if we got any outputs (original format)
              if (data.type === 'output-list' && data.outputs && data.outputs.length > 0) {
                // Parse the DID document from the LARS response
                const output = data.outputs[0];
                console.log('[BsvOverlayRegistry] Found output:', output);
                
                // Check if output has BEEF data (new format)
                if (output.beef) {
                  console.log('[BsvOverlayRegistry] Found BEEF data in output-list response!');
                  try {
                    // Parse the transaction from BEEF
                    const beefArray = Array.isArray(output.beef) ? output.beef : [output.beef];
                    const tx = Transaction.fromBEEF(beefArray);
                    console.log('[BsvOverlayRegistry] Parsed transaction from BEEF:', tx.id('hex'));
                    
                    // Get the output at the specified index
                    const outputIndex = output.outputIndex || 0;
                    if (!tx.outputs || tx.outputs.length <= outputIndex) {
                      throw new Error(`Transaction has no output at index ${outputIndex}`);
                    }
                    
                    const txOutput = tx.outputs[outputIndex];
                    console.log('[BsvOverlayRegistry] Found output at index', outputIndex);
                    
                    // Decode the PushDrop to get the DID document
                    const result = PushDrop.decode(txOutput.lockingScript);
                    if (!result.fields || result.fields.length === 0) {
                      throw new Error('PushDrop decode returned no fields');
                    }
                    
                    const didDocumentString = Utils.toUTF8(result.fields[0]);
                    const didDocument = JSON.parse(didDocumentString);
                    
                    // Validate that it's a proper DID document
                    if (!didDocument.id || !didDocument.id.startsWith('did:')) {
                      throw new Error('Invalid DID document: missing or invalid id');
                    }
                    
                    console.log('[BsvOverlayRegistry] Successfully parsed DID document from BEEF:', didDocument);
                    return didDocument;
                    
                  } catch (beefError) {
                    console.error('[BsvOverlayRegistry] Error parsing BEEF data from output-list:', beefError);
                    console.error('[BsvOverlayRegistry] BEEF parsing failed, trying fields fallback');
                  }
                }
                
                // Fallback to old format with fields
                if (output.fields && output.fields.length > 0) {
                  // Parse the DID document from the first field
                  const didDocumentField = output.fields[0];
                  console.log('[BsvOverlayRegistry] DID document field:', didDocumentField);
                  
                  try {
                    const didDocument = typeof didDocumentField === 'string' 
                      ? JSON.parse(didDocumentField) 
                      : didDocumentField;
                    console.log('[BsvOverlayRegistry] Parsed DID document:', didDocument);
                    return didDocument;
                  } catch (parseError) {
                    console.error('[BsvOverlayRegistry] Error parsing DID document:', parseError);
                  }
                }
              } else {
                console.log('[BsvOverlayRegistry] No outputs found in LARS response');
              }
            } catch (error) {
              console.error('[BsvOverlayRegistry] Error querying LARS:', error);
              throw error;
            }
          }
        } else {
          console.log('[BsvOverlayRegistry] DID not found in MongoDB');
        }
      }
      
      console.log('[BsvOverlayRegistry] Failed to resolve DID - not found in MongoDB or LARS');
      return null;
      
    } catch (error) {
      console.error('[BsvOverlayRegistry] Error resolving DID:', error);
      console.error('[BsvOverlayRegistry] Error stack:', (error as Error).stack);
      console.error('[BsvOverlayRegistry] Error type:', (error as Error).constructor.name);
      throw new Error(`Failed to resolve DID: ${(error as Error).message}`);
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
    try {
      console.log('[BsvOverlayRegistry] Updating DID via BRC-100 WalletClient...');
      
      // Parse existing DID
      const parts = did.split(':');
      if (parts.length !== 5) {
        console.error('[BsvOverlayRegistry] ERROR: Invalid DID format');
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
            satoshis: 1,
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
        console.error('[BsvOverlayRegistry] Error stack:', error.stack);
        console.error('[BsvOverlayRegistry] Error type:', error.constructor.name);
        throw error;
      }
    } catch (error) {
      console.error('[BsvOverlayRegistry] Error updating DID:', error);
      console.error('[BsvOverlayRegistry] Error stack:', error.stack);
      console.error('[BsvOverlayRegistry] Error type:', error.constructor.name);
      throw error;
    }
  }

  /**
   * Notify overlay provider about a new DID
   * This helps with indexing and faster lookups
   */
  private async notifyOverlayProvider(topic: string, beef: AtomicBEEF, serialNumber: string, txid: string, outputIndex: number): Promise<void> {
    try {
      const url = `${this.overlayProvider}/submit`;
      console.log('[BsvOverlayRegistry] ===== NOTIFY OVERLAY PROVIDER =====');
      console.log('[BsvOverlayRegistry] Submitting to overlay service:', url);
      console.log('[BsvOverlayRegistry] Topic:', topic);
      console.log('[BsvOverlayRegistry] BEEF data length:', beef.length);
      console.log('[BsvOverlayRegistry] First 100 bytes of BEEF:', beef.slice(0, 100));

      // Determine network preset based on overlay URL
      const isLocalhost = this.overlayProvider.includes('localhost') || this.overlayProvider.includes('127.0.0.1');
      const networkPreset = isLocalhost ? 'local' : 'mainnet';
      
      console.log('[BsvOverlayRegistry] Creating TopicBroadcaster with networkPreset:', networkPreset);
      const broadcaster = new TopicBroadcaster([topic], { networkPreset })
      const response = await broadcaster.broadcast(Transaction.fromBEEF(beef, txid))

      console.log('[BsvOverlayRegistry] Overlay provider response status:', response.status);
      console.log('[BsvOverlayRegistry] Full response:', JSON.stringify(response, null, 2));
      
      // Check if the submission was successful
      if (response.status === 'error' || response.status?.toLowerCase() === 'error') {
        console.error('[BsvOverlayRegistry] LARS submission failed with error status');
        throw new Error(`LARS submission failed: ${JSON.stringify(response)}`);
      }
      
      console.log('[BsvOverlayRegistry] Successfully submitted to overlay provider');
    } catch (error) {
      console.error('[BsvOverlayRegistry] Error notifying overlay provider:', error);
      console.error('[BsvOverlayRegistry] Error stack:', error.stack);
      console.error('[BsvOverlayRegistry] Error type:', error.constructor.name);
      throw error;
    }
  }
  
  /**
   * Build OP_RETURN script using @bsv/sdk Script class
   */
  private buildOpReturnScript(...data: string[]): string {
    try {
      const script = new Script();
      script.writeOpCode(0);   // OP_FALSE
      script.writeOpCode(106); // OP_RETURN
      
      for (const item of data) {
        script.writeBin(Utils.toArray(item, 'utf8'));
      }
      
      return script.toHex();
    } catch (error) {
      console.error('[BsvOverlayRegistry] Error building OP_RETURN script:', error);
      console.error('[BsvOverlayRegistry] Error stack:', error.stack);
      console.error('[BsvOverlayRegistry] Error type:', error.constructor.name);
      throw error;
    }
  }
}
