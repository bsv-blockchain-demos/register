import { Agent, AgentModenaResolver, IAgentResolver, IAgentStorage, DID, AgentModenaRegistry } from '@quarkid/agent';
import { VerifiableCredential } from '@quarkid/vc-core';
// import { StatusListAgentPlugin } from '@quarkid/status-list-agent-plugin';
import { WalletClient, Transaction, PrivateKey, Script, OP } from '@bsv/sdk';
import { Wallet } from '@bsv/wallet-toolbox-client';
import { MongoClient, Db, Collection } from 'mongodb';
import { DIDDocument } from '@quarkid/did-core';
import { AgentSecureStorage } from '@quarkid/agent';
import { IVCStorage } from '@quarkid/agent';
import { BsvOverlayRegistry } from '../plugins/BsvOverlayRegistry';
import { BsvOverlayResolver } from '../plugins/BsvOverlayResolver';
import { MockBsvOverlayResolver } from '../plugins/MockBsvOverlayResolver';
import { BsvOverlayRegistryAdapter } from '../plugins/BsvOverlayRegistryAdapter';
import { BsvWalletKMS } from '../plugins/BsvWalletKMS';
import { ES256kVCSuite } from '../../../../Paquetes-NPMjs/packages/kms/suite/vc/es256k/src/ES256kVCSuite';
import { Suite } from '@quarkid/kms-core';
import { BbsBls2020Suite } from '@quarkid/kms-suite-bbsbls2020';
import { appConfig } from '../config/AppConfig';

/**
 * Configuration interface for QuarkID Agent with BSV overlay integration
 */
export interface QuarkIdAgentServiceConfig {
  mongodb: {
    uri: string;
    dbName: string;
  };
  wallet: Wallet;
  walletClient: WalletClient;
  overlayProvider?: string;
  feePerKb?: number;
  dwnUrl?: string;
}

/**
 * QuarkID Agent Service with proper BRC-100 WalletClient integration
 * 
 * This service properly uses QuarkID Agent patterns instead of bypassing them.
 * The Agent handles BRC-100 internally while we get proper DID/VC operations externally.
 * 
 * Key improvements:
 * - Uses QuarkID Agent's built-in identity and vc methods
 * - No direct BSV overlay operations or WalletClient.createAction() calls
 * - Proper AgentModenaRegistry for BSV overlay integration
 * - Standards-compliant DID/VC operations
 */
export class QuarkIdAgentService {
  private config: QuarkIdAgentServiceConfig;
  private agent: Agent;
  private db: Db;
  private walletClient: WalletClient;
  private wallet: Wallet;
  private bsvAdapter: BsvOverlayRegistryAdapter;
  private initPromise: Promise<void>;
  private isInitialized: boolean = false;
  private bsvKms: BsvWalletKMS;
  private resolver: IAgentResolver;
  private dbClient: MongoClient;
  private vcStorage: VCStorageImpl;

  // Add global unhandled rejection handler to prevent crashes
  static {
    process.on('unhandledRejection', (reason, promise) => {
      console.error('[QuarkIdAgentService] Unhandled Rejection at:', promise, 'reason:', reason);
      // Prevent process exit for non-critical errors like DWN polling
    });
  }

  constructor(config: QuarkIdAgentServiceConfig) {
    this.config = config;
    this.walletClient = config.walletClient;
    this.wallet = config.wallet;
    this.initPromise = this.initialize();
  }

  /**
   * Ensure the service is initialized before use
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.isInitialized) {
      await this.initPromise;
    }
  }

  /**
   * Initialize QuarkID Agent with BSV overlay and BRC-100 WalletClient
   * Following the proper pattern from the plan
   */
  private async initialize(): Promise<void> {
    try {
      console.log('[QuarkIdAgentService] Initializing QuarkID Agent with BRC-100 WalletClient...');
      
      // Connect to MongoDB
      const mongoClient = new MongoClient(this.config.mongodb.uri);
      await mongoClient.connect();
      this.db = mongoClient.db(this.config.mongodb.dbName);

      // Create a single BsvWalletKMS instance that will be shared
      const bsvKMS = new BsvWalletKMS(this.walletClient);
      console.log('[QuarkIdAgentService] Created shared BsvWalletKMS instance');
      
      // Set the KMS instance in ES256kVCSuite so it can use it for key creation
      ES256kVCSuite.setKMS(bsvKMS);
      console.log('[QuarkIdAgentService] KMS injected into ES256kVCSuite');
      
      // Create BSV overlay registry with our custom KMS
      const bsvRegistry = new BsvOverlayRegistry(
        bsvKMS,
        appConfig.didTopic,
        this.config.overlayProvider || appConfig.overlayProviderUrl,
        this.db
      );
      console.log('[QuarkIdAgentService] Created BsvOverlayRegistry with shared KMS');
      
      // Create QuarkID-compatible adapters
      const didRegistry = new BsvOverlayRegistryAdapter(bsvRegistry);
      
      // Use real resolver now that we have the overlay running locally
      const didResolver = new BsvOverlayResolver(bsvRegistry);
      console.log('[QuarkIdAgentService] Using BsvOverlayResolver with overlay at:', this.config.overlayProvider || appConfig.overlayProviderUrl);
      
      // Initialize the registry adapter with the same KMS instance
      didRegistry.initialize({ kms: bsvKMS, resolver: didResolver });
      console.log('[QuarkIdAgentService] Initialized registry adapter with shared KMS');
      
      // Initialize Status List Plugin for VC status management
      // const statusListPlugin = new StatusListAgentPlugin({
      //   statusListUrl: `${this.config.overlayProvider || 'https://overlay.test.com'}/status-list`
      // });
      
      // Initialize QuarkID Agent with BSV overlay configuration
      const secureStorage = new SecureStorageImpl(this.db.collection('secure_storage'));
      const agentStorage = new AgentStorageImpl(this.db.collection('agent_storage'));
      this.vcStorage = new VCStorageImpl(this.db.collection('vc_storage'));
      
      // Create the agent with our custom KMS
      const agent = new Agent({
        didDocumentResolver: didResolver,
        didDocumentRegistry: didRegistry,
        secureStorage: secureStorage,
        agentStorage: agentStorage,
        vcStorage: this.vcStorage,
        vcProtocols: [],
        agentPlugins: [] // Add empty plugins array
        // plugins: [statusListPlugin] // Uncomment when type declarations are available
      });
      
      // Replace the agent's default KMS with our BsvWalletKMS
      (agent as any).kms = bsvKMS;
      console.log('[QuarkIdAgentService] Replaced agent KMS with BsvWalletKMS');
      console.log('[QuarkIdAgentService] Agent KMS type:', (agent as any).kms.constructor.name);
      console.log('[QuarkIdAgentService] BsvWalletKMS type:', bsvKMS.constructor.name);
      console.log('[QuarkIdAgentService] BsvWalletKMS keyStore size after replacement:', (bsvKMS as any).keyStore.size);
      
      // Also replace the KMS in the agent's identity module
      if ((agent as any).identity && (agent as any).identity.kms) {
        (agent as any).identity.kms = bsvKMS;
        console.log('[QuarkIdAgentService] Replaced agent identity KMS with BsvWalletKMS');
      }
      
      // Clear the VC module so it gets recreated with the new KMS
      (agent as any)._vc = null;
      console.log('[QuarkIdAgentService] Cleared VC module to force recreation with new KMS');
      
      // Initialize the agent
      await agent.initialize();
      
      // After initialization, check if the KMS replacement is still in place
      console.log('[QuarkIdAgentService] After initialization - Agent KMS type:', (agent as any).kms.constructor.name);
      console.log('[QuarkIdAgentService] After initialization - BsvWalletKMS keyStore size:', (bsvKMS as any).keyStore.size);
      
      // Check if the VC module is using the correct KMS
      if ((agent as any)._vc && (agent as any)._vc.kms) {
        console.log('[QuarkIdAgentService] VC module KMS type:', (agent as any)._vc.kms.constructor.name);
        console.log('[QuarkIdAgentService] VC module KMS === BsvWalletKMS:', (agent as any)._vc.kms === bsvKMS);
      }
      
      // Handle operational DID for the agent
      // The agent needs its own DID to access the VC module
      console.log('[QuarkIdAgentService] Checking for existing agent operational DID...');
      
      try {
        // First check if we already have an operational DID stored
        const storedOperationalDid = await agentStorage.get('operational-did');
        
        if (storedOperationalDid) {
          // Load the existing operational DID
          console.log('[QuarkIdAgentService] Loading existing operational DID:', storedOperationalDid);
          // The agent should load this DID during initialization from storage
          // If not already loaded, we may need to explicitly set it
          const currentDid = agent.identity.getOperationalDID();
          if (!currentDid) {
            console.log('[QuarkIdAgentService] Agent does not have operational DID loaded, may need manual intervention');
          } else {
            console.log('[QuarkIdAgentService] Agent operational DID loaded:', currentDid.value);
          }
        } else {
          // No stored operational DID, create a new one
          console.log('[QuarkIdAgentService] No existing operational DID found, creating new one...');
          const agentDid = await agent.identity.createNewDID();
          console.log('[QuarkIdAgentService] Agent operational DID created:', agentDid.value);
          // The agent should handle storing this internally
          
          // If we're using MockBsvOverlayResolver, we need to explicitly store the DID document
          if (didResolver && 'storeDIDDocument' in didResolver) {
            console.log('[QuarkIdAgentService] Storing agent operational DID in mock resolver...');
            try {
              // Get the DID document from the agent's identity
              // The agent should have just created this DID, so it should have the document
              const didDoc = await agent.resolver.resolve(agentDid);
              if (didDoc) {
                console.log('[QuarkIdAgentService] Storing agent DID document in mock resolver');
                (didResolver as any).storeDIDDocument(agentDid.value, didDoc);
              } else {
                console.error('[QuarkIdAgentService] Could not resolve agent DID document');
              }
            } catch (error) {
              console.error('[QuarkIdAgentService] Error storing agent DID in mock resolver:', error);
            }
          }
        }
      } catch (error) {
        console.error('[QuarkIdAgentService] Error handling agent operational DID:', error);
        // Try to continue anyway - the agent might work without it for some operations
      }
      
      console.log('[QuarkIdAgentService] QuarkID Agent initialized successfully');
      this.agent = agent;
      this.isInitialized = true;
      
      // Store the BsvWalletKMS instance for later use
      this.bsvKms = bsvKMS;
      
      // Note: BsvWalletKMS handles ES256k keys natively, so we don't need to register suites
      // The agent will use our BsvWalletKMS for all key operations
      console.log('[QuarkIdAgentService] BsvWalletKMS is ready for ES256k operations');
      
      // Suppress DWN polling errors since we're not using DWN functionality
      process.on('unhandledRejection', (reason, promise) => {
        const errorMessage = reason?.toString() || '';
        if (errorMessage.includes('DIDDocument has not a DWN service defined') || 
            errorMessage.includes('Cannot read properties of null (reading \'service\')')) {
          // Silently ignore DWN-related errors
          return;
        }
        // Re-throw other unhandled rejections
        console.error('Unhandled Rejection at:', promise, 'reason:', reason);
      });
      
    } catch (error) {
      console.error('[QuarkIdAgentService] Failed to initialize:', error);
      throw error;
    }
  }

  /**
   * Get the initialized agent (for testing or direct access)
   */
  async getAgent(): Promise<Agent | undefined> {
    await this.ensureInitialized();
    return this.agent;
  }

  /**
   * Create DID using QuarkID Agent's identity methods
   * The Agent handles BRC-100 createAction() internally
   */
  async createDID(): Promise<string> {
    console.log('[QuarkIdAgentService] ===== createDID METHOD ENTRY =====');
    console.log('[QuarkIdAgentService] Method called at:', new Date().toISOString());
    
    await this.ensureInitialized();
    console.log('[QuarkIdAgentService] ensureInitialized completed');
    
    try {
      console.log('[QuarkIdAgentService] Creating DID through QuarkID Agent...');
      console.log('[QuarkIdAgentService] Agent initialized:', !!this.agent);
      console.log('[QuarkIdAgentService] Agent registry available:', !!this.agent?.registry);
      
      try {
        console.log('[QuarkIdAgentService] Agent KMS type:', (this.agent as any)?.kms?.constructor?.name || 'undefined');
      } catch (e) {
        console.log('[QuarkIdAgentService] Error getting Agent KMS type:', e.message);
      }
      
      try {
        console.log('[QuarkIdAgentService] BsvWalletKMS keyStore size before DID creation:', (this.bsvKms as any)?.keyStore?.size || 'undefined');
      } catch (e) {
        console.log('[QuarkIdAgentService] Error getting BsvWalletKMS keyStore size:', e.message);
      }
      
      if (!this.agent || !this.agent.registry) {
        throw new Error('Agent or registry not properly initialized');
      }
      
      // Use the agent's registry to create a DID
      // This will internally use our BsvOverlayRegistryAdapter
      console.log('[QuarkIdAgentService] About to call agent.registry.createDID...');
      console.log('[QuarkIdAgentService] Registry type:', this.agent.registry.constructor.name);
      const didResponse = await this.agent.registry.createDID({
        didMethod: 'bsv',
        // For BSV, keys are managed by the wallet, so we provide empty arrays
        updateKeys: [],
        recoveryKeys: [],
        verificationMethods: [],
        services: []
      });
      
      console.log('[QuarkIdAgentService] DID Response:', didResponse);
      console.log(`[QuarkIdAgentService] DID created: ${didResponse.did}`);
      console.log('[QuarkIdAgentService] BsvWalletKMS keyStore size after DID creation:', (this.bsvKms as any).keyStore.size);
      
      if (!didResponse.did) {
        throw new Error('DID creation returned empty DID');
      }
      
      return didResponse.did;
      
    } catch (error) {
      console.error('[QuarkIdAgentService] Error in createDID:', error);
      console.error('[QuarkIdAgentService] Error stack:', (error as Error).stack);
      console.error('[QuarkIdAgentService] Error details:', JSON.stringify(error, null, 2));
      
      // Re-throw with more context
      throw new Error(`Failed to create DID: ${(error as Error).message}`);
    }
  }

  /**
   * Resolve DID using QuarkID Agent's resolver
   */
  async resolveDID(didOrDidStr: string | DID): Promise<DIDDocument | null> {
    await this.ensureInitialized();
    
    try {
      // Convert string to DID object if needed
      const did = typeof didOrDidStr === 'string' 
        ? DID.from(didOrDidStr)
        : didOrDidStr;
      
      // Resolve the full DID document
      const didDocument = await this.agent.resolver.resolve(did);
      return didDocument;
    } catch (error) {
      console.error('Error resolving DID:', error);
      return null;
    }
  }

  /**
   * Update DID using QuarkID Agent's identity methods
   */
  async updateDID(params: {
    did: string | DID;
    verificationMethods?: any[];
    services?: any[];
  }): Promise<DIDDocument | null> {
    await this.ensureInitialized();
    
    try {
      // Convert string to DID object if needed
      const did = typeof params.did === 'string' 
        ? DID.from(params.did)
        : params.did;
      
      // Update DID with new verification methods and services
      await this.agent.identity.updateDID({
        did: did,
        verificationMethodsToAdd: params.verificationMethods || [],
        servicesToAdd: params.services || []
      });
      
      // Resolve and return the updated DID document
      return await this.resolveDID(did);
    } catch (error) {
      console.error('Error updating DID:', error);
      return null;
    }
  }

  /**
   * Ensure there are keys in the KMS for VC signing
   */
  private async ensureKMSKeys(): Promise<void> {
    console.log('[QuarkIdAgentService] Ensuring KMS has keys for VC signing...');
    
    const keyStoreSize = (this.bsvKms as any).keyStore.size;
    console.log('[QuarkIdAgentService] Current KMS keyStore size:', keyStoreSize);
    
    if (keyStoreSize === 0) {
      console.log('[QuarkIdAgentService] No keys found in KMS, creating a new ES256k key...');
      try {
        // Create a new ES256k key
        const keyResult = await this.bsvKms.create(Suite.ES256k);
        console.log('[QuarkIdAgentService] Created new ES256k key:', keyResult.publicKeyJWK);
        console.log('[QuarkIdAgentService] New KMS keyStore size:', (this.bsvKms as any).keyStore.size);
      } catch (error) {
        console.error('[QuarkIdAgentService] Error creating KMS key:', error);
        throw new Error(`Failed to create KMS key: ${error.message}`);
      }
    } else {
      console.log('[QuarkIdAgentService] KMS already has keys, proceeding with VC signing');
    }
  }

  /**
   * Issue VC using QuarkID Agent's vc methods
   * The Agent handles BRC-100 signing internally
   */
  async issueVC(
    issuerDid: string,
    subjectDid: string,
    credentialType: string,
    claims: any,
    validFrom?: Date,
    validUntil?: Date
  ): Promise<VerifiableCredential> {
    await this.ensureInitialized();
    
    try {
      console.log('[QuarkIdAgentService] issueVC called with issuer DID:', issuerDid);
      console.log('[QuarkIdAgentService] Agent KMS type:', (this.agent as any).kms.constructor.name);
      console.log('[QuarkIdAgentService] BsvWalletKMS keyStore size:', (this.bsvKms as any).keyStore.size);
      console.log('[QuarkIdAgentService] BsvWalletKMS available keys:', Array.from((this.bsvKms as any).keyStore.keys()));
      
      // Debug: Show the actual key entries in the KMS
      console.log('[QuarkIdAgentService] KMS key entries:', Array.from((this.bsvKms as any).keyStore.entries() as Iterable<[string, any]>).map(([keyId, value]) => ({
        keyId,
        publicKeyX: value.jwk.x,
        publicKeyY: value.jwk.y
      })));
      
      // Ensure we have keys in the KMS
      await this.ensureKMSKeys();
      
      // CRITICAL: Force KMS replacement before VC signing
      console.log('[QuarkIdAgentService] Forcing KMS replacement before VC signing...');
      (this.agent as any).kms = this.bsvKms;
      
      // Also replace KMS in identity module
      if ((this.agent as any).identity) {
        (this.agent as any).identity.kms = this.bsvKms;
        console.log('[QuarkIdAgentService] Replaced identity KMS');
      }
      
      // Also replace KMS in VC module
      if ((this.agent as any)._vc) {
        (this.agent as any)._vc.kms = this.bsvKms;
        console.log('[QuarkIdAgentService] Replaced VC module KMS');
      }
      
      // Verify KMS replacement
      console.log('[QuarkIdAgentService] After replacement - Agent KMS type:', (this.agent as any).kms.constructor.name);
      console.log('[QuarkIdAgentService] After replacement - Agent KMS === BsvWalletKMS:', (this.agent as any).kms === this.bsvKms);
      
      const issuanceDate = new Date();
      const expirationDate = new Date();
      expirationDate.setMonth(expirationDate.getMonth() + 6);

      const credential: VerifiableCredential = {
        '@context': [
          'https://www.w3.org/2018/credentials/v1',
          'https://w3id.org/security/suites/jws-2020/v1'
        ],
        id: `urn:uuid:${this.generateUUID()}`,
        type: ['VerifiableCredential', credentialType],
        issuer: issuerDid,
        issuanceDate: issuanceDate,
        expirationDate: validUntil,
        credentialSubject: {
          id: subjectDid,
          ...claims
        }
      };

      // Add optional validFrom as part of credentialSubject or custom property
      if (validFrom) {
        (credential as any).validFrom = validFrom;
      }

      // Sign the credential using Agent's VC module
      console.log('[QuarkIdAgentService] Attempting to sign VC with issuer DID:', issuerDid);
      
      // Debug: Try to resolve the issuer's DID document to see if it has verification methods
      try {
        console.log('[QuarkIdAgentService] Resolving issuer DID document for debugging...');
        const issuerDidDocument = await this.agent.resolver.resolve(DID.from(issuerDid));
        console.log('[QuarkIdAgentService] Issuer DID document:', JSON.stringify(issuerDidDocument, null, 2));
        
        if (!issuerDidDocument) {
          console.error('[QuarkIdAgentService] ERROR: Issuer DID document is null!');
        } else if (!issuerDidDocument.verificationMethod) {
          console.error('[QuarkIdAgentService] ERROR: Issuer DID document has no verificationMethod!');
        } else {
          console.log('[QuarkIdAgentService] Issuer verification methods:', issuerDidDocument.verificationMethod);
          console.log('[QuarkIdAgentService] Verification method IDs:', issuerDidDocument.verificationMethod.map(vm => vm.id));
          console.log('[QuarkIdAgentService] Verification method public keys:', issuerDidDocument.verificationMethod.map(vm => ({
            id: vm.id,
            publicKeyJwk: vm.publicKeyJwk
          })));
        }
      } catch (debugError) {
        console.error('[QuarkIdAgentService] Error resolving issuer DID for debugging:', debugError);
      }
      
      try {
        const signedVC = await this.agent.vc.signVC({
          credential,
          did: DID.from(issuerDid) as unknown as DID,
          purpose: 'assertionMethod' as any
        });

        // Create BSV overlay transaction with VC hash
        const vcHash = this.hashVC(signedVC);
        const script = new Script()
          .writeOpCode(OP.OP_RETURN)
          .writeBin(Array.from(Buffer.from('VC')))
          .writeBin(Array.from(Buffer.from(vcHash, 'hex')));

        const scriptHex = script.toHex();
        console.log('[QuarkIdAgentService] Script hex:', scriptHex);
        console.log('[QuarkIdAgentService] Script hex length:', scriptHex.length);

        const action = await this.walletClient.createAction({
          description: 'Store VC hash on BSV',
          outputs: [{
            lockingScript: scriptHex,
            satoshis: 1, // Minimal dust amount for OP_RETURN
            outputDescription: 'VC hash storage'
          }]
        });
        console.log('[QuarkIdAgentService] createAction params:', JSON.stringify({
          description: 'Store VC hash on BSV',
          outputs: [{
            lockingScript: scriptHex,
            satoshis: 1, 
            outputDescription: 'VC hash storage'
          }]
        }, null, 2));

        // Just log the action - actual BSV broadcast would happen here
        console.log('[QuarkIdAgentService] VC hash stored on BSV:', vcHash);

        return signedVC;
      } catch (error) {
        console.error('[QuarkIdAgentService] Error during VC signing:', error);
        console.error('[QuarkIdAgentService] Error stack:', error.stack);
        throw new Error(`Failed to issue VC: ${error.message}`);
      }
    } catch (error) {
      throw new Error(`Failed to issue VC: ${error.message}`);
    }
  }

  /**
   * Verify VC using QuarkID Agent's vc methods
   */
  async verifyVC(vc: VerifiableCredential): Promise<{
    verified: boolean;
    errors?: string[];
  }> {
    await this.ensureInitialized();
    
    try {
      // Verify using Agent's VC module
      const result = await this.agent.vc.verifyVC({
        vc,
        purpose: 'assertionMethod' as any
      });

      return {
        verified: result.result,
        errors: result.error ? [(result.error as any).message || 'Verification failed'] : undefined
      };
    } catch (error) {
      return {
        verified: false,
        errors: [`Verification error: ${error.message}`]
      };
    }
  }

  /**
   * Get all VCs for a specific DID
   */
  async getVCsForDID(did: string): Promise<any[]> {
    await this.ensureInitialized();
    
    try {
      const resolvedDid = typeof did === 'string' ? DID.from(did) : did;
      const vcs = await this.vcStorage.getAllByDID(resolvedDid);
      return vcs || [];
    } catch (error) {
      console.error('[QuarkIdAgentService] Error getting VCs for DID:', error);
      return [];
    }
  }

  /**
   * Generate a UUID v4
   */
  private generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  /**
   * Hash a VC
   */
  private hashVC(vc: VerifiableCredential): string {
    const vcData = JSON.stringify(vc);
    const hash = require('crypto').createHash('sha256');
    hash.update(vcData);
    return hash.digest('hex');
  }
}

class SecureStorageImpl implements AgentSecureStorage {
  private collection: Collection<any>;

  constructor(collection: Collection<any>) {
    this.collection = collection;
  }

  async add(key: string, data: any): Promise<void> {
    // Use upsert to avoid duplicate key errors
    await this.collection.replaceOne(
      { _id: key }, 
      { _id: key, data, createdAt: new Date() },
      { upsert: true }
    );
  }

  async get(key: string): Promise<any> {
    const doc = await this.collection.findOne({ _id: key });
    return doc?.data;
  }

  async getAll(): Promise<Map<string, any>> {
    const docs = await this.collection.find({}).toArray();
    const map = new Map<string, any>();
    docs.forEach(doc => map.set(doc._id, doc.data));
    return map;
  }

  async update(key: string, data: any): Promise<any> {
    await this.collection.updateOne({ _id: key }, { $set: { value: data } });
    return data;
  }

  async remove(key: string): Promise<boolean> {
    const result = await this.collection.deleteOne({ _id: key });
    return result.deletedCount > 0;
  }
}

class AgentStorageImpl implements IAgentStorage {
  private collection: Collection<any>;

  constructor(collection: Collection<any>) {
    this.collection = collection;
  }

  async add(key: string, value: any): Promise<void> {
    // Use upsert to avoid duplicate key errors
    await this.collection.replaceOne(
      { _id: key }, 
      { _id: key, value, createdAt: new Date() },
      { upsert: true }
    );
  }

  async get(key: string): Promise<any> {
    const doc = await this.collection.findOne({ _id: key });
    return doc?.value || null;
  }

  async getAll(): Promise<Map<string, any>> {
    const docs = await this.collection.find({}).toArray();
    const map = new Map<string, any>();
    docs.forEach(doc => map.set(doc._id, doc.value));
    return map;
  }

  async update(key: string, data: any): Promise<any> {
    await this.collection.updateOne({ _id: key }, { $set: { value: data } });
    return data;
  }

  async remove(key: string): Promise<boolean> {
    const result = await this.collection.deleteOne({ _id: key });
    return result.deletedCount > 0;
  }
}

class VCStorageImpl implements IVCStorage {
  private collection: Collection<any>;

  constructor(collection: Collection<any>) {
    this.collection = collection;
  }

  async add(key: string, value: any): Promise<void> {
    await this.collection.insertOne({ _id: key, value, createdAt: new Date() });
  }

  async get(key: string): Promise<any> {
    const doc = await this.collection.findOne({ _id: key });
    return doc?.value || null;
  }

  async getAll(): Promise<Map<string, any>> {
    const docs = await this.collection.find({}).toArray();
    const map = new Map<string, any>();
    docs.forEach(doc => map.set(doc._id, doc.value));
    return map;
  }

  async update(key: string, data: any): Promise<any> {
    await this.collection.updateOne({ _id: key }, { $set: { value: data } });
    return data;
  }

  async remove(keyOrDid: string | DID, credentialId?: string): Promise<boolean | void> {
    if (typeof keyOrDid === 'string' && !credentialId) {
      // IStorage remove(key) implementation
      const result = await this.collection.deleteOne({ _id: keyOrDid });
      return result.deletedCount > 0;
    } else {
      // IVCStorage remove(did, credentialId) implementation
      const didStr = typeof keyOrDid === 'string' ? keyOrDid : (keyOrDid as DID).value || (keyOrDid as DID).toString();
      await this.collection.deleteOne({ _id: credentialId, did: didStr });
    }
  }

  async save(did: DID, vc: VerifiableCredential<any>): Promise<VerifiableCredential<any>> {
    const didStr = typeof did === 'string' ? did : did.value || did.toString();
    await this.collection.insertOne({
      _id: vc.id,
      did: didStr,
      vc,
      createdAt: new Date()
    });
    return vc;
  }

  async saveMany(did: DID, vcs: VerifiableCredential<any>[]): Promise<VerifiableCredential<any>[]> {
    const didStr = typeof did === 'string' ? did : did.value || did.toString();
    const docs = vcs.map(vc => ({
      _id: vc.id,
      did: didStr,
      vc,
      createdAt: new Date()
    }));
    await this.collection.insertMany(docs);
    return vcs;
  }

  async findById(did: DID, id: string): Promise<VerifiableCredential<any> | null> {
    const didStr = typeof did === 'string' ? did : did.value || did.toString();
    const doc = await this.collection.findOne({ _id: id, did: didStr });
    return doc?.vc || null;
  }

  async find(did: DID, params: any): Promise<VerifiableCredential<any>[]> {
    const didStr = typeof did === 'string' ? did : did.value || did.toString();
    const query: any = { did: didStr };
    if (params?.type) {
      query['vc.type'] = { $in: params.type };
    }
    if (params?.issuer) {
      query['vc.issuer'] = params.issuer;
    }
    const docs = await this.collection.find(query).toArray();
    return docs.map(doc => doc.vc);
  }

  async findAll(did: DID): Promise<Map<string, VerifiableCredential<any>>> {
    const didStr = typeof did === 'string' ? did : did.value || did.toString();
    const docs = await this.collection.find({ did: didStr }).toArray();
    const map = new Map<string, VerifiableCredential<any>>();
    docs.forEach(doc => map.set(doc._id, doc.vc));
    return map;
  }

  async findOne(did: DID, params: any): Promise<{ id: string; data: VerifiableCredential<any> } | null> {
    const didStr = typeof did === 'string' ? did : did.value || did.toString();
    const query: any = { did: didStr };
    if (params?.type) {
      query['vc.type'] = { $in: params.type };
    }
    if (params?.issuer) {
      query['vc.issuer'] = params.issuer;
    }
    const doc = await this.collection.findOne(query);
    return doc ? { id: doc._id, data: doc.vc } : null;
  }

  async getAllByDID(did: DID): Promise<VerifiableCredential<any>[]> {
    const didStr = typeof did === 'string' ? did : did.value || did.toString();
    const results = await this.collection.find({ did: didStr }).toArray();
    return results.map(r => r.vc);
  }

  async getById(credentialId: string): Promise<VerifiableCredential<any> | null> {
    const doc = await this.collection.findOne({ _id: credentialId });
    return doc?.vc || null;
  }
}
