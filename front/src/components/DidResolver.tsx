// src/components/DIDResolver.tsx
import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { didService } from '../services/didService';
import type { DidResolutionResult, Actor } from '../types';

const DIDResolver: React.FC = () => {
  const { state } = useApp();
  const location = useLocation();
  const [didToResolve, setDidToResolve] = useState<string>('');
  const [resolutionResult, setResolutionResult] = useState<DidResolutionResult | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedTab, setSelectedTab] = useState<'resolve' | 'actors' | 'examples'>('resolve');

  // Check if a DID was passed from QR Scanner
  useEffect(() => {
    const scannedDid = location.state?.scannedDid;
    if (scannedDid && typeof scannedDid === 'string') {
      setDidToResolve(scannedDid);
      // Directly call the resolution logic here to avoid dependency issues
      setIsLoading(true);
      setError(null);
      setResolutionResult(null);
      
      didService.resolveDid(scannedDid)
        .then(response => {
          setResolutionResult(response);
        })
        .catch((err: unknown) => {
          const errorMessage = err instanceof Error ? err.message : 'Failed to resolve DID';
          setError(errorMessage);
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [location.state]);

  const handleResolveDid = async (did?: string) => {
    const didToUse = did || didToResolve.trim();
    if (!didToUse) return;
    
    setIsLoading(true);
    setError(null);
    setResolutionResult(null);
    
    try {
      const response = await didService.resolveDid(didToUse);
      setResolutionResult(response);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to resolve DID';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const resolveActorDid = async (actor: Actor) => {
    if (!actor.did) return;
    
    setDidToResolve(actor.did);
    setSelectedTab('resolve');
    
    setIsLoading(true);
    setError(null);
    setResolutionResult(null);
    
    try {
      const response = await didService.resolveDid(actor.did);
      setResolutionResult(response);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to resolve DID';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const clearResults = () => {
    setDidToResolve('');
    setResolutionResult(null);
    setError(null);
  };

  const getDIDMethod = (did: string): string => {
    const parts = did.split(':');
    return parts.length >= 2 ? parts[1] : 'unknown';
  };

  const formatDIDDocument = (didDocument: Record<string, unknown>) => {
    if (!didDocument) return null;

    return (
      <div className="did-document">
        <div className="did-section">
          <h5>🆔 Identity</h5>
          <div className="did-field">
            <span className="field-label">ID:</span>
            <span className="field-value did-value">{String(didDocument.id || '')}</span>
          </div>
          <div className="did-field">
            <span className="field-label">Context:</span>
            <span className="field-value">
              {Array.isArray(didDocument['@context']) 
                ? (didDocument['@context'] as string[]).join(', ')
                : String(didDocument['@context'] || '')
              }
            </span>
          </div>
        </div>

        {didDocument.verificationMethod && Array.isArray(didDocument.verificationMethod) && didDocument.verificationMethod.length > 0 ? (
          <div className="did-section">
            <h5>🔑 Verification Methods</h5>
            <div className="verification-methods">
              {(didDocument.verificationMethod as Array<Record<string, unknown>>).map((method, index) => (
                <div key={index} className="verification-method">
                  <div className="method-header">
                    <span className="method-id">#{String(method.id || '').split('#')[1] || String(method.id || '')}</span>
                    <span className="method-type">{String(method.type || '')}</span>
                  </div>
                  <div className="method-details">
                    <div className="method-field">
                      <span className="field-label">Controller:</span>
                      <span className="field-value">{String(method.controller || '')}</span>
                    </div>
                    {method.publicKeyJwk && typeof method.publicKeyJwk === 'object' ? (
                      <div className="method-field">
                        <span className="field-label">Key Type:</span>
                        <span className="field-value">{String((method.publicKeyJwk as Record<string, unknown>).kty || '')}</span>
                      </div>
                    ) : null}
                    {method.publicKeyMultibase ? (
                      <div className="method-field">
                        <span className="field-label">Public Key:</span>
                        <span className="field-value key-value">
                          {String(method.publicKeyMultibase).slice(0, 20)}...
                        </span>
                      </div>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {/* Services */}
        {didDocument.service && Array.isArray(didDocument.service) && didDocument.service.length > 0 ? (
          <div className="did-section">
            <h5>🔗 Services</h5>
            <div className="services">
              {(didDocument.service as Array<Record<string, unknown>>).map((service, index) => (
                <div key={index} className="service">
                  <div className="service-header">
                    <span className="service-id">{String(service.id || '')}</span>
                    <span className="service-type">{String(service.type || '')}</span>
                  </div>
                  <div className="service-endpoint">
                    <span className="field-label">Endpoint:</span>
                    <span className="field-value">{String(service.serviceEndpoint || '')}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {/* Authentication */}
        {didDocument.authentication && Array.isArray(didDocument.authentication) && didDocument.authentication.length > 0 ? (
          <div className="did-section">
            <h5>🔐 Authentication</h5>
            <div className="auth-methods">
              {(didDocument.authentication as Array<string | Record<string, unknown>>).map((auth, index) => (
                <div key={index} className="auth-item">
                  {typeof auth === 'string' ? auth : String((auth as Record<string, unknown>).id || '')}
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {/* Assertion Method */}
        {didDocument.assertionMethod && Array.isArray(didDocument.assertionMethod) && didDocument.assertionMethod.length > 0 ? (
          <div className="did-section">
            <h5>✅ Assertion Method</h5>
            <div className="assertion-methods">
              {(didDocument.assertionMethod as Array<string | Record<string, unknown>>).map((method, index) => (
                <div key={index} className="assertion-item">
                  {typeof method === 'string' ? method : String((method as Record<string, unknown>).id || '')}
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {/* Other properties */}
        {Object.entries(didDocument).filter(([key]) => 
          !['@context', 'id', 'verificationMethod', 'service', 'authentication', 'assertionMethod', 'keyAgreement', 'capabilityInvocation', 'capabilityDelegation'].includes(key)
        ).map(([key, value]) => (
          <div key={key} className="did-section">
            <h5>📋 {key.charAt(0).toUpperCase() + key.slice(1)}</h5>
            <div className="property-content">
              {renderValue(value, key)}
            </div>
          </div>
        ))}
      </div>
    );
  };

  const exampleDIDs = [
    {
      method: 'BSV Overlay',
      did: 'did:bsv:tm_qdid:9c7c9b9e8b5a4f3d2e1c0b9a8f7e6d5c4b3a2f1e0d9c8b7a6f5e4d3c2b1a0f9e8:0',
      description: 'BSV overlay DID for medical license verification'
    },
    {
      method: 'ION',
      did: 'did:ion:EiC9h3VhCVA7wOvAcSvVKD0ZMqwRJ8jZGTuq5FjNrNrjmA',
      description: 'ION DID on Bitcoin network'
    },
    {
      method: 'Key',
      did: 'did:key:z6MkpTHR8VNsBxYAAWHut2Geadd9jSwuBV8xRoAnwWsdvktH',
      description: 'Simple cryptographic key-based DID'
    }
  ];

  const renderValue = (value: unknown, key?: string): React.ReactNode => {
    if (value === null) return <span className="text-gray-500">null</span>;
    if (value === undefined) return <span className="text-gray-500">undefined</span>;
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    if (Array.isArray(value)) {
      return (
        <div className="ml-4">
          {value.map((item, index) => (
            <div key={index} className="border-l-2 border-gray-200 pl-2 mb-1">
              {renderValue(item, `${key}[${index}]`)}
            </div>
          ))}
        </div>
      );
    }
    if (typeof value === 'object') {
      return (
        <div className="ml-4">
          {Object.entries(value as Record<string, unknown>).map(([objKey, objValue]) => (
            <div key={objKey} className="border-l-2 border-gray-200 pl-2 mb-1">
              <span className="font-medium text-blue-600">{objKey}:</span>{' '}
              {renderValue(objValue, objKey)}
            </div>
          ))}
        </div>
      );
    }
    return String(value);
  };

  return (
    <div className="did-resolver">
      <div className="page-header">
        <h2>🔍 DID Resolver</h2>
        <p>Resolve and inspect Decentralized Identifiers from various methods</p>
      </div>

      {/* Tab Navigation */}
      <div className="tab-navigation">
        <button 
          className={`tab-button ${selectedTab === 'resolve' ? 'active' : ''}`}
          onClick={() => setSelectedTab('resolve')}
        >
          🔍 Resolve DID
        </button>
        <button 
          className={`tab-button ${selectedTab === 'actors' ? 'active' : ''}`}
          onClick={() => setSelectedTab('actors')}
        >
          👥 Local Actors
        </button>
        <button 
          className={`tab-button ${selectedTab === 'examples' ? 'active' : ''}`}
          onClick={() => setSelectedTab('examples')}
        >
          📋 Examples
        </button>
      </div>

      {/* Resolve Tab */}
      {selectedTab === 'resolve' && (
        <div className="resolve-section">
          <div className="resolver-form">
            <div className="form-group">
              <label htmlFor="did-input">DID to Resolve</label>
              <div className="input-with-button">
                <input
                  id="did-input"
                  type="text"
                  value={didToResolve}
                  onChange={(e) => setDidToResolve(e.target.value)}
                  placeholder="did:bsv:tm_qdid:txid:vout or did:ion:..."
                  className="did-input"
                  disabled={isLoading}
                />
                <button 
                  className="primary-button"
                  onClick={() => handleResolveDid()} 
                  disabled={isLoading || !didToResolve.trim()}
                >
                  {isLoading ? '⏳ Resolving...' : '🔍 Resolve'}
                </button>
              </div>
            </div>

            {didToResolve && (
              <div className="did-info">
                <div className="did-method-badge">
                  Method: {getDIDMethod(didToResolve)}
                </div>
                <button 
                  className="tertiary-button"
                  onClick={clearResults}
                >
                  🗑️ Clear
                </button>
              </div>
            )}
          </div>

          {/* Results */}
          <div className="resolution-results">
            {error && (
              <div className="result-card error-card">
                <div className="result-header">
                  <span className="result-icon">❌</span>
                  <h4>Resolution Error</h4>
                </div>
                <div className="result-content">
                  <p>{error}</p>
                </div>
              </div>
            )}

            {resolutionResult && (
              <div className="result-card success-card">
                <div className="result-header">
                  <span className="result-icon">✅</span>
                  <h4>DID Document Resolved</h4>
                </div>
                <div className="result-content">
                  <div className="resolution-metadata">
                    <div className="metadata-row">
                      <span className="label">Method:</span>
                      <span className="value">{getDIDMethod(didToResolve)}</span>
                    </div>
                    <div className="metadata-row">
                      <span className="label">DID:</span>
                      <span className="value did-value">{didToResolve}</span>
                    </div>
                    {resolutionResult.didResolutionMetadata?.contentType ? (
                      <div className="metadata-row">
                        <span className="label">Content Type:</span>
                        <span className="value">{String(resolutionResult.didResolutionMetadata.contentType)}</span>
                      </div>
                    ) : null}

                    {resolutionResult.didDocument ? (
                      <div className="did-document-section">
                        <h4>📄 DID Document</h4>
                        {formatDIDDocument(resolutionResult.didDocument)}
                      </div>
                    ) : (
                      <div className="no-document">
                        <p>No DID document found or document format not supported for display.</p>
                      </div>
                    )}

                    <details className="raw-response">
                      <summary>View Raw Resolution Response</summary>
                      <pre className="json-output">
                        {JSON.stringify(resolutionResult, null, 2)}
                      </pre>
                    </details>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Actors Tab */}
      {selectedTab === 'actors' && (
        <div className="actors-section">
          <h3>👥 Local Actors</h3>
          <p>Resolve DIDs for actors created in this demo</p>
          
          {state.actors.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">👥</div>
              <h4>No Actors Created</h4>
              <p>Create actors in Actor Management to see their DIDs here</p>
            </div>
          ) : (
            <div className="actors-grid">
              {state.actors.map(actor => (
                <div key={actor.id} className="actor-card">
                  <div className="actor-header">
                    <div className="actor-icon">{actor.type === 'patient' ? '👤' : actor.type === 'doctor' ? '👨‍⚕️' : actor.type === 'pharmacy' ? '🏥' : '🏢'}</div>
                    <div className="actor-info">
                      <h4>{actor.name}</h4>
                      <span className="actor-type">{actor.type}</span>
                    </div>
                  </div>
                  
                  <div className="actor-did">
                    <div className="did-label">DID:</div>
                    <div className="did-value">{actor.did}</div>
                  </div>

                  <div className="actor-method">
                    <span className="method-badge">{actor.did ? getDIDMethod(actor.did) : 'unknown'}</span>
                  </div>

                  <div className="actor-actions">
                    <button 
                      className="primary-button"
                      onClick={() => resolveActorDid(actor)}
                    >
                      🔍 Resolve DID
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Examples Tab */}
      {selectedTab === 'examples' && (
        <div className="examples-section">
          <h3>📋 DID Method Examples</h3>
          <p>Example DIDs from different methods you can try resolving</p>
          
          <div className="examples-grid">
            {exampleDIDs.map((example, index) => (
              <div key={index} className="example-card">
                <div className="example-header">
                  <div className="example-method">{example.method}</div>
                </div>
                
                <div className="example-content">
                  <div className="example-did">{example.did}</div>
                  <div className="example-description">{example.description}</div>
                </div>

                <div className="example-actions">
                  <button 
                    className="secondary-button"
                    onClick={() => {
                      setDidToResolve(example.did);
                      setSelectedTab('resolve');
                    }}
                  >
                    📋 Copy to Resolver
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="supported-methods">
            <h4>🔧 Supported DID Methods</h4>
            <div className="methods-list">
              <div className="method-item">
                <span className="method-name">BSV Overlay</span>
                <span className="method-pattern">did:bsv:&lt;topic&gt;:&lt;txid&gt;:&lt;vout&gt;</span>
                <span className="method-status supported">✅ Supported</span>
              </div>
              <div className="method-item">
                <span className="method-name">ION (Sidetree)</span>
                <span className="method-pattern">did:ion:&lt;identifier&gt;</span>
                <span className="method-status supported">✅ Supported</span>
              </div>
              <div className="method-item">
                <span className="method-name">Key</span>
                <span className="method-pattern">did:key:&lt;multibase-key&gt;</span>
                <span className="method-status supported">✅ Supported</span>
              </div>
              <div className="method-item">
                <span className="method-name">Web</span>
                <span className="method-pattern">did:web:&lt;domain&gt;</span>
                <span className="method-status partial">⚠️ Partial</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Info Section */}
      <div className="info-section">
        <h3>ℹ️ About DID Resolution</h3>
        <div className="info-content">
          <p>
            DID Resolution is the process of retrieving a DID Document from a Decentralized Identifier. 
            The DID Document contains cryptographic keys, service endpoints, and other metadata 
            associated with the DID.
          </p>
          
          <div className="resolution-process">
            <h4>🔄 Resolution Process</h4>
            <div className="process-steps">
              <div className="process-step">
                <span className="step-number">1</span>
                <span className="step-description">Parse DID to identify method</span>
              </div>
              <div className="process-step">
                <span className="step-number">2</span>
                <span className="step-description">Contact appropriate resolver</span>
              </div>
              <div className="process-step">
                <span className="step-number">3</span>
                <span className="step-description">Retrieve and validate DID Document</span>
              </div>
              <div className="process-step">
                <span className="step-number">4</span>
                <span className="step-description">Return resolution result</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DIDResolver;
