import { IAgentRegistry, CreateDIDRequest, CreateDIDResponse, UpdateDIDRequest, DID } from '@quarkid/agent';
import { IKMS } from '@quarkid/kms-core';
import { DIDDocument, Service, VerificationMethodTypes } from '@quarkid/did-core';
import { BsvOverlayRegistry } from './BsvOverlayRegistry';
import { Suite } from '@quarkid/kms-core';

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
  protected kms: IKMS | null = null;
  
  constructor(bsvRegistry: BsvOverlayRegistry) {
    super();
    this.bsvRegistry = bsvRegistry;
  }
  
  /**
   * Initialize the registry with KMS
   * For BSV, key management is handled by the wallet
   */
  initialize(params: { kms: IKMS }): void {
    this.kms = params.kms;
    console.log('[BsvOverlayRegistryAdapter] Registry initialized with KMS');
  }
  
  /**
   * Get the KMS instance
   * In our BSV implementation, key management is handled by the wallet
   */
  getKMS(): IKMS {
    if (!this.kms) {
      throw new Error('KMS not initialized. BSV keys are managed by the wallet.');
    }
    return this.kms;
  }
  
  /**
   * Create a new DID
   * Delegates to BsvOverlayRegistry which uses BRC-100 WalletClient
   */
  async createDID(createRequest: CreateDIDRequest): Promise<CreateDIDResponse> {
    console.log('[BsvOverlayRegistryAdapter] createDID called with request:', createRequest);
    
    // Check if KMS is available
    if (!this.kms) {
      throw new Error('KMS not initialized. Cannot create DID without key management.');
    }
    
    // Generate a new key pair using the KMS
    console.log('[BsvOverlayRegistryAdapter] Creating key pair with KMS...');
    const keyResult = await this.kms.create(Suite.ES256k);
    const publicKeyJWK = keyResult.publicKeyJWK;
    
    // Reconstruct the keyId from the public key (matching the pattern used in BsvWalletKMS)
    const keyId = `did:bsv:${publicKeyJWK.x.substring(0, 16)}`;
    
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
    const result = await this.bsvRegistry.createDID({
      didDocument,
      publicKeyJWK,
      keyId
    });
    
    console.log('[BsvOverlayRegistryAdapter] bsvRegistry result:', result);
    console.log('[BsvOverlayRegistryAdapter] Final DID document:', result.didDocument);
    
    // The registry now returns a complete DID document with verification methods
    // Store the key association in KMS
    // The KMS should already have the key stored from the create() call
    console.log('[BsvOverlayRegistryAdapter] Key pair created and associated with DID:', result.did);
    
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
    const currentDoc = await this.bsvRegistry.resolveDID(didString);
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
