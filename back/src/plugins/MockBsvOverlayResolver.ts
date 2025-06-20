import { IAgentResolver, DID } from '@quarkid/agent';
import { BsvOverlayRegistry } from './BsvOverlayRegistry';

/**
 * Mock BSV Overlay Resolver for testing
 * This resolver stores DID documents in memory instead of fetching from an external service
 */
export class MockBsvOverlayResolver implements IAgentResolver {
  private registry: BsvOverlayRegistry;
  private didDocuments: Map<string, any> = new Map();

  constructor(registry: BsvOverlayRegistry) {
    this.registry = registry;
  }

  /**
   * Store a DID document in the mock resolver
   */
  storeDIDDocument(did: string, document: any): void {
    console.log('[MockBsvOverlayResolver] Storing DID document:', did);
    console.log('[MockBsvOverlayResolver] Document to store:', JSON.stringify(document, null, 2));
    this.didDocuments.set(did, document);
    console.log('[MockBsvOverlayResolver] Total stored documents:', this.didDocuments.size);
    console.log('[MockBsvOverlayResolver] All stored DIDs:', Array.from(this.didDocuments.keys()));
  }

  /**
   * Resolve a DID to its document
   */
  async resolve(did: DID): Promise<any> {
    try {
      // Get the DID string from the DID object
      const didString = did.value || did.toString();
      
      console.log('[MockBsvOverlayResolver] Resolving DID:', didString);
      
      // Check if it's a BSV DID
      if (!didString.startsWith('did:bsv:')) {
        console.log('[MockBsvOverlayResolver] Not a BSV DID, returning null');
        return null;
      }

      // Check if we have the document stored
      if (this.didDocuments.has(didString)) {
        const document = this.didDocuments.get(didString);
        console.log('[MockBsvOverlayResolver] Found stored document:', JSON.stringify(document, null, 2));
        return document;
      }

      console.log('[MockBsvOverlayResolver] DID document not found in mock storage:', didString);
      return null;
    } catch (error) {
      console.error('[MockBsvOverlayResolver] Error resolving DID:', error);
      return null;
    }
  }

  /**
   * Resolve a DID with metadata
   * Required by IAgentResolver interface
   */
  async resolveWithMetdata(did: DID): Promise<any> {
    const didDocument = await this.resolve(did);
    return {
      didDocument,
      didDocumentMetadata: {},
      didResolutionMetadata: {}
    };
  }

  /**
   * Get resolution metadata for a DID
   * @param did The DID to get metadata for
   * @returns The resolution metadata
   */
  async getResolutionResult(did: DID): Promise<any> {
    try {
      // Get the DID string from the DID object
      const didString = did.value || did.toString();
      
      // Check if it's a BSV DID
      if (!didString.startsWith('did:bsv:')) {
        return {
          '@context': 'https://w3id.org/did-resolution/v1',
          didDocument: null,
          didResolutionMetadata: {
            'error': {
              'message': 'unsupported DID method',
              'didNotFound': [],
              'didNotCreated': []
            },
            'duration': 0,
            'identifier': ''
          }
        };
      }

      const didDocument = await this.resolve(did);
      
      if (!didDocument) {
        return {
          '@context': 'https://w3id.org/did-resolution/v1',
          didDocument: null,
          didResolutionMetadata: {
            'error': {
              'message': 'DID not found',
              'didNotFound': [],
              'didNotCreated': []
            },
            'duration': 0,
            'identifier': ''
          }
        };
      }

      // Parse the DID to get metadata
      const parts = didString.split(':');
      const topic = parts[2];
      const txid = parts[3];
      const vout = parts[4];

      return {
        '@context': 'https://w3id.org/did-resolution/v1',
        didDocument,
        didResolutionMetadata: {
          'error': {
            'message': null,
            'didNotFound': [], // Empty array = found
            'didNotCreated': []
          },
          'duration': parseInt(vout, 10), // Using vout as mock duration
          'identifier': didString.split(':').slice(0, 3).join(':') // did:bsv:topic
        }
      };

    } catch (error) {
      return {
        '@context': 'https://w3id.org/did-resolution/v1',
        didDocument: null,
        didResolutionMetadata: {
          'error': {
            'message': 'resolution error',
            'didNotFound': [],
            'didNotCreated': []
          },
          'duration': 0,
          'identifier': ''
        }
      };
    }
  }
}
