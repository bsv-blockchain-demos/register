// DID Resolution Service
import type { DidResolutionResult } from '../types';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';

class DIDService {
    async resolveDid(did: string): Promise<DidResolutionResult> {
        try {
            const response = await fetch(`${BACKEND_URL}/v1/dids/resolve/${encodeURIComponent(did)}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.description || `Failed to resolve DID: ${response.statusText}`);
            }

            const result = await response.json();
            
            // Backend returns {status, data: {didDocument}}
            if (result.status === 'success' && result.data?.didDocument) {
                return {
                    didDocument: result.data.didDocument,
                    didResolutionMetadata: {
                        contentType: 'application/did+ld+json'
                    },
                    didDocumentMetadata: {
                        // Add metadata if available from backend
                        created: result.data.didDocument.created || new Date().toISOString(),
                        updated: result.data.didDocument.updated || new Date().toISOString()
                    }
                };
            }

            throw new Error('Invalid response format from backend');
        } catch (error) {
            console.error('DID resolution error:', error);
            throw error;
        }
    }
}

export const didService = new DIDService();
