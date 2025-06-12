import { IAgentRegistry, CreateDIDRequest, CreateDIDResponse, UpdateDIDRequest, DID } from '@quarkid/agent';
import { IKMS } from '@quarkid/kms-core';
import { DIDDocument, Service, VerificationMethodTypes } from '@quarkid/did-core';
import { BsvOverlayRegistry } from './BsvOverlayRegistry';

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
    
    // If request includes specific keys or services, add them
    if (createRequest.services) {
      didDocument.service = createRequest.services;
    }
    
    console.log('[BsvOverlayRegistryAdapter] Calling bsvRegistry.createDID...');
    
    // Create the DID on BSV overlay
    const result = await this.bsvRegistry.createDID(didDocument);
    
    console.log('[BsvOverlayRegistryAdapter] bsvRegistry result:', result);
    
    // Update the document with the generated DID
    didDocument.id = result.did;
    
    // Add default verification method if none provided
    if (didDocument.verificationMethod.length === 0) {
      didDocument.verificationMethod = [{
        id: `${result.did}#primary`,
        controller: result.did,
        type: VerificationMethodTypes.EcdsaSecp256k1VerificationKey2019,
        publicKeyBase58: 'wallet-managed' // Actual key is in wallet
      }];
      
      // Reference the verification method in authentication
      didDocument.authentication = [`${result.did}#primary`];
      didDocument.assertionMethod = [`${result.did}#primary`];
    }
    
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
