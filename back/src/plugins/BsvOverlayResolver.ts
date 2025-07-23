import { IAgentResolver, DID } from '@quarkid/agent';
import { DIDDocument } from '@quarkid/did-core';
import { ModenaResponse } from '@quarkid/did-resolver';
import { BsvOverlayRegistry } from './BsvOverlayRegistry';

/**
 * BSV Overlay Resolver adapter for QuarkID Agent
 * 
 * This implements the IAgentResolver interface by wrapping
 * our BsvOverlayRegistry to provide DID resolution capabilities
 * that are compatible with QuarkID Agent's expected interface.
 */
export class BsvOverlayResolver implements IAgentResolver {
  private registry: BsvOverlayRegistry;
  
  constructor(registry: BsvOverlayRegistry) {
    this.registry = registry;
  }
  
  /**
   * Resolve a DID and return the DID document
   */
  async resolve(did: DID): Promise<DIDDocument | null> {
    try {
      // Extract the DID string from the DID object
      const didString = did.value || did.toString();
      
      // Only handle BSV DIDs
      if (!didString.startsWith('did:bsv:')) {
        return null;
      }
      
      return await this.registry.resolveDID(didString);
    } catch (error) {
      console.error('[BsvOverlayResolver] Error resolving DID:', error);
      return null;
    }
  }
  
  /**
   * Resolve a DID with full metadata
   * Required by IAgentResolver interface
   */
  async resolveWithMetdata(did: DID): Promise<ModenaResponse> {
    try {
      // Extract the DID string from the DID object
      const didString = did.value || did.toString();
      
      // Only handle BSV DIDs
      if (!didString.startsWith('did:bsv:')) {
        return {
          "@context": "https://www.w3.org/ns/did/v1",
          didDocument: null,
          didDocumentMetadata: {
            method: {
              published: false,
              recoveryCommitment: [],
              updateCommitment: []
            },
            versionId: 0,
            canonicalId: ''
          }
        };
      }
      
      const didDocument = await this.registry.resolveDID(didString);
      
      if (!didDocument) {
        return {
          "@context": "https://www.w3.org/ns/did/v1",
          didDocument: null,
          didDocumentMetadata: {
            method: {
              published: false,
              recoveryCommitment: [],
              updateCommitment: []
            },
            versionId: 0,
            canonicalId: ''
          }
        };
      }
      
      // Parse DID to extract metadata (new format: did:bsv:<topic>:<serialNumber>)
      const parts = didString.split(':');
      const topic = parts[2];
      const serialNumber = parts[3];
      
      return {
        "@context": "https://www.w3.org/ns/did/v1",
        didDocument,
        didDocumentMetadata: {
          method: {
            published: true,
            recoveryCommitment: [], // BSV overlay doesn't use these
            updateCommitment: []
          },
          versionId: 1, // Use 1 as default version for new format
          canonicalId: didString, // Full DID is canonical
        }
      };
      
    } catch (error) {
      return {
        "@context": "https://www.w3.org/ns/did/v1",
        didDocument: null,
        didDocumentMetadata: {
          method: {
            published: false,
            recoveryCommitment: [],
            updateCommitment: []
          },
          versionId: 0,
          canonicalId: ''
        }
      };
    }
  }
}
