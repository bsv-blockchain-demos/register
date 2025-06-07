// Mock DID service for demo purposes  
import type { DidResolutionResult } from '../types';

class MockDidService {
    async resolveDid(did: string): Promise<DidResolutionResult> {
        const didParts = did.split(':');
        if (didParts.length < 4) {
            throw new Error('Invalid DID format');
        }

        const method = didParts[1];
        const identifier = didParts.slice(2).join(':');

        if (method === 'bsv') {
            return {
                didDocument: {
                    '@context': ['https://www.w3.org/ns/did/v1'],
                    id: did,
                    verificationMethod: [{
                        id: `${did}#key-1`,
                        type: 'EcdsaSecp256k1VerificationKey2019',
                        controller: did,
                        publicKeyHex: '02' + '0'.repeat(64) 
                    }],
                    authentication: [`${did}#key-1`],
                    assertionMethod: [`${did}#key-1`],
                    service: [{
                        id: `${did}#medical-service`,
                        type: 'MedicalCredentialService',
                        serviceEndpoint: 'https://example.com/medical'
                    }]
                },
                didResolutionMetadata: {
                    contentType: 'application/did+ld+json'
                },
                didDocumentMetadata: {
                    created: new Date().toISOString(),
                    updated: new Date().toISOString()
                }
            };
        } else if (method === 'ion') {
            return {
                didDocument: {
                    '@context': ['https://www.w3.org/ns/did/v1'],
                    id: did,
                    verificationMethod: [{
                        id: `${did}#key-1`,
                        type: 'JsonWebKey2020',
                        controller: did,
                        publicKeyJwk: {
                            kty: 'EC',
                            crv: 'secp256k1',
                            x: 'mock-x-value',
                            y: 'mock-y-value'
                        }
                    }],
                    authentication: [`${did}#key-1`]
                },
                didResolutionMetadata: {
                    contentType: 'application/did+ld+json'
                },
                didDocumentMetadata: {}
            };
        } else if (method === 'key') {
            return {
                didDocument: {
                    '@context': ['https://www.w3.org/ns/did/v1'],
                    id: did,
                    verificationMethod: [{
                        id: `${did}#${identifier}`,
                        type: 'Ed25519VerificationKey2020',
                        controller: did,
                        publicKeyMultibase: identifier
                    }],
                    authentication: [`${did}#${identifier}`],
                    assertionMethod: [`${did}#${identifier}`],
                    keyAgreement: [`${did}#${identifier}`],
                    capabilityInvocation: [`${did}#${identifier}`],
                    capabilityDelegation: [`${did}#${identifier}`]
                },
                didResolutionMetadata: {
                    contentType: 'application/did+ld+json'
                },
                didDocumentMetadata: {}
            };
        }

        throw new Error(`Unsupported DID method: ${method}`);
    }
}

export const didService = new MockDidService();
