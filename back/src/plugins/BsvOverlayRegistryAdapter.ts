import { IAgentRegistry, CreateDIDRequest, CreateDIDResponse, UpdateDIDRequest, DID } from '@quarkid/agent';
import { IKMS, Suite } from '@quarkid/kms-core';
import { DIDDocument, Service, VerificationMethodTypes } from '@quarkid/did-core';
import { BsvOverlayRegistry } from './BsvOverlayRegistry';
import { CreateActionResult } from '@bsv/sdk';

/**
 * BSV Overlay Registry Adapter for QuarkID Agent
 * 
 * This adapter wraps our BsvOverlayRegistry to implement the full
 * IAgentRegistry interface expected by QuarkID Agent. It bridges
 * between the BRC-100 WalletClient approach and QuarkID's registry
 * pattern.
 */
export class BsvOverlayRegistryAdapter extends IAgentRegistry {
  private bsvRegistry: BsvOverlayRegistry;
  private resolver: any = null; // Type as 'any' since it could be MockBsvOverlayResolver or BsvOverlayResolver
  private car: CreateActionResult;
  
  constructor(bsvRegistry: BsvOverlayRegistry) {
    super();
    this.bsvRegistry = bsvRegistry;
  }
  
  /**
   * Initialize the registry with KMS and optional resolver
   * For BSV, key management is handled by the wallet
   */
  initialize(params: { kms: IKMS; resolver?: any }): void {
    console.log('[BsvOverlayRegistryAdapter] initialize called with params:', {
      kmsExists: !!params.kms,
      kmsType: params.kms?.constructor?.name,
      resolverExists: !!params.resolver
    });
    
    // Only initialize if we don't already have a BsvWalletKMS
    if (this.kms && this.kms.constructor.name === 'BsvWalletKMS') {
      console.log('[BsvOverlayRegistryAdapter] Already initialized with BsvWalletKMS, skipping re-initialization');
      return;
    }
    
    this.kms = params.kms;
    this.resolver = params.resolver;
    
    console.log('[BsvOverlayRegistryAdapter] KMS assigned:', {
      kmsExists: !!this.kms,
      kmsType: this.kms?.constructor?.name,
      keyStoreExists: !!(this.kms as any)?.keyStore,
      keyStoreSize: (this.kms as any)?.keyStore?.size
    });
    
    console.log('[BsvOverlayRegistryAdapter] Registry initialized with KMS and resolver');
  }
  
  /**
   * Get the KMS instance
   * In our BSV implementation, key management is handled by the wallet
   */
  getKMS(): IKMS {
    console.log('[BsvOverlayRegistryAdapter] getKMS called');
    console.log('[BsvOverlayRegistryAdapter] KMS exists:', !!this.kms);
    if (!this.kms) {
      throw new Error('KMS not initialized. BSV keys are managed by the wallet.');
    }
    console.log('[BsvOverlayRegistryAdapter] Returning KMS instance');
    return this.kms;
  }
  
  /**
   * Create a new DID
   * Delegates to BsvOverlayRegistry which uses BRC-100 WalletClient
   */
  async createDID(createRequest: CreateDIDRequest): Promise<CreateDIDResponse> {
    console.log('[BsvOverlayRegistryAdapter] ===== ENTRY: createDID called =====');
    console.log('[BsvOverlayRegistryAdapter] createDID called with request:', createRequest);
    
    // Check if KMS is available
    if (!this.kms) {
      console.error('[BsvOverlayRegistryAdapter] ERROR: KMS not initialized!');
      throw new Error('KMS not initialized. Cannot create DID without key management.');
    }
    
    console.log('[BsvOverlayRegistryAdapter] KMS check passed, KMS exists:', !!this.kms);
    console.log('[BsvOverlayRegistryAdapter] KMS type:', this.kms.constructor.name);
    
    // Generate a new key pair using the KMS
    console.log('[BsvOverlayRegistryAdapter] Creating key pair with KMS...');
    const keyResult = await this.kms.create(Suite.ES256k);
    console.log('[BsvOverlayRegistryAdapter] Key creation completed, keyResult:', !!keyResult);
    const publicKeyJWK = keyResult.publicKeyJWK;
    console.log('[BsvOverlayRegistryAdapter] Extracted publicKeyJWK:', !!publicKeyJWK);
    
    // Create the keyId that will be used in the verification method
    const keyId = `did:bsv:${publicKeyJWK.x.substring(0, 16)}`;
    
    console.log('[BsvOverlayRegistryAdapter] Created key with ID:', keyId);
    console.log('[BsvOverlayRegistryAdapter] KMS keyStore size after key creation:', (this.kms as any)?.keyStore?.size || 'undefined');
    
    // Safety check for KMS
    if (!this.kms) {
      console.error('[BsvOverlayRegistryAdapter] ERROR: KMS is undefined after key creation!');
      throw new Error('KMS is undefined after key creation. This should not happen.');
    }
    
    if (!(this.kms as any).keyStore) {
      console.error('[BsvOverlayRegistryAdapter] ERROR: KMS keyStore is undefined!');
      throw new Error('KMS keyStore is undefined. This should not happen.');
    }
    
    // Create a basic DID document structure
    const didDocument: DIDDocument = {
      '@context': ['https://www.w3.org/ns/did/v1'],
      id: '', // Will be set by the registry
      verificationMethod: [],
      authentication: [],
      assertionMethod: [],
      keyAgreement: [],
      capabilityInvocation: [],
      capabilityDelegation: [],
      service: []
    };
    
    // If request includes specific services, add them
    if (createRequest.services) {
      didDocument.service = createRequest.services;
    }
    
    console.log('[BsvOverlayRegistryAdapter] Calling bsvRegistry.createDID with publicKeyJWK...');
    
    // Create the DID on BSV overlay with the public key
    let result;
    try {
      console.log('[BsvOverlayRegistryAdapter] About to call bsvRegistry.createDID...');
      console.log('[BsvOverlayRegistryAdapter] bsvRegistry instance:', this.bsvRegistry);
      console.log('[BsvOverlayRegistryAdapter] bsvRegistry.createDID method exists:', typeof this.bsvRegistry.createDID);
      console.log('[BsvOverlayRegistryAdapter] Actual createDID function:', this.bsvRegistry.createDID.toString().substring(0, 200));
      
      // Debug: Check what the bsvRegistry object actually is
      console.log('[BsvOverlayRegistryAdapter] bsvRegistry constructor name:', this.bsvRegistry.constructor.name);
      console.log('[BsvOverlayRegistryAdapter] bsvRegistry prototype:', Object.getPrototypeOf(this.bsvRegistry));
      console.log('[BsvOverlayRegistryAdapter] Is bsvRegistry an instance of BsvOverlayRegistry?:', this.bsvRegistry.constructor.name === 'BsvOverlayRegistry');
      
      // Check if createDID is bound correctly
      const createDIDMethod = this.bsvRegistry.createDID;
      console.log('[BsvOverlayRegistryAdapter] createDID method is bound to:', createDIDMethod);
      console.log('[BsvOverlayRegistryAdapter] createDID method name:', createDIDMethod.name);
      
      result = await this.bsvRegistry.createDID({
        didDocument,
        publicKeyJWK,
        keyId
      });

      this.car = result.car;
      
      console.log('[BsvOverlayRegistryAdapter] Successfully called bsvRegistry.createDID');
    } catch (error) {
      console.error('[BsvOverlayRegistryAdapter] Error calling bsvRegistry.createDID:', error);
      console.error('[BsvOverlayRegistryAdapter] Error stack:', error.stack);
      throw error;
    }
    
    console.log('[BsvOverlayRegistryAdapter] bsvRegistry result:', result);
    console.log('[BsvOverlayRegistryAdapter] Final DID document:', result.didDocument);
    
    // If we have a mock resolver, store the DID document for testing
    if (this.resolver && 'storeDIDDocument' in this.resolver) {
      console.log('[BsvOverlayRegistryAdapter] Storing DID document in mock resolver for testing');
      this.resolver.storeDIDDocument(result.did, result.didDocument);
    }
    
    // The registry now returns a complete DID document with verification methods
    // The key should already be stored in the KMS from the create() call above
    console.log('[BsvOverlayRegistryAdapter] Key pair created and associated with DID:', result.did);
    console.log('[BsvOverlayRegistryAdapter] Final KMS keyStore size:', (this.kms as any)?.keyStore?.size || 'undefined');
    console.log('[BsvOverlayRegistryAdapter] KMS available keys:', Array.from((this.kms as any)?.keyStore?.keys() || []));
    
    console.log('[BsvOverlayRegistryAdapter] Returning CreateDIDResponse with did:', result.did);
    
    // Return in the format expected by QuarkID Agent
    return {
      did: result.did
    };
  }
  
  /**
   * Update DID document
   * Uses BSV overlay update mechanism
   */
  async updateDIDDocument(updateRequest: UpdateDIDRequest): Promise<void> {
    const { did, kms, updatePublicKey, documentMetadata, verificationMethodsToAdd, servicesToAdd, idsOfVerificationMethodsToRemove, idsOfServiceToRemove } = updateRequest;
    
    // Convert DID to string if needed
    const didString = typeof did === 'string' ? did : did.value || did.toString();
    
    // First resolve the current document
    const currentDoc = await this.bsvRegistry.resolveDID(didString, this.car);
    if (!currentDoc) {
      throw new Error('DID not found');
    }
    
    // Apply updates to the document
    const updatedDoc: DIDDocument = { ...currentDoc };
    
    // Add new verification methods if specified
    if (verificationMethodsToAdd && verificationMethodsToAdd.length > 0) {
      updatedDoc.verificationMethod = [
        ...(updatedDoc.verificationMethod || []),
        ...verificationMethodsToAdd.map(vm => ({
          id: vm.id,
          type: vm.type as VerificationMethodTypes,
          controller: didString,
          publicKeyJwk: vm.publicKeyJwk
        }))
      ];
    }
    
    // Remove verification methods if specified
    if (idsOfVerificationMethodsToRemove && idsOfVerificationMethodsToRemove.length > 0) {
      updatedDoc.verificationMethod = (updatedDoc.verificationMethod || []).filter(
        vm => !idsOfVerificationMethodsToRemove.includes(vm.id)
      );
    }
    
    // Add new services if specified
    if (servicesToAdd && servicesToAdd.length > 0) {
      updatedDoc.service = [
        ...(updatedDoc.service || []),
        ...servicesToAdd
      ];
    }
    
    // Remove services if specified
    if (idsOfServiceToRemove && idsOfServiceToRemove.length > 0) {
      updatedDoc.service = (updatedDoc.service || []).filter(
        svc => !idsOfServiceToRemove.includes(svc.id)
      );
    }
    
    // Update on BSV overlay
    await this.bsvRegistry.updateDID(didString, updatedDoc);
  }
  
  /**
   * Get supported DID methods
   * BSV overlay only supports 'bsv' method
   */
  get supportedMethods(): string[] {
    return ['bsv'];
  }
  
  /**
   * Check if a DID method is supported
   */
  isMethodSupported(method: string): boolean {
    return method === 'bsv';
  }
}
