// src/components/DidResolver.tsx
import React, { useState } from 'react';
import { didService } from '../services/didService';
import { DidResolutionResult } from '../types';

const DidResolver: React.FC = () => {
  const [didToResolve, setDidToResolve] = useState<string>('');
  const [resolutionResult, setResolutionResult] = useState<DidResolutionResult | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleResolveDid = async () => {
    if (!didToResolve.trim()) {
      setError('Please enter a DID to resolve.');
      return;
    }
    setIsLoading(true);
    setError(null);
    setResolutionResult(null);

    try {
      const result = await didService.resolveDid(didToResolve.trim());
      setResolutionResult(result);
    } catch (err: any) {
      setError(err.message || 'Failed to resolve DID.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ marginTop: '20px', padding: '20px', border: '1px solid #eee' }}>
      <h2>Resolve QuarkID DID</h2>
      <input
        type="text"
        value={didToResolve}
        onChange={(e) => setDidToResolve(e.target.value)}
        placeholder="Enter DID (e.g., did:bsv-overlay:tm_qdid:txid:vout)"
        style={{ width: '400px', marginRight: '10px', padding: '8px' }}
      />
      <button onClick={handleResolveDid} disabled={isLoading}>
        {isLoading ? 'Resolving...' : 'Resolve DID'}
      </button>

      {isLoading && <p>Loading...</p>}
      {error && <p style={{ color: 'red' }}>Error: {error}</p>}
      {resolutionResult && (
        <div style={{ marginTop: '10px', border: '1px solid #ccc', padding: '10px', background: '#f9f9f9' }}>
          <h4>Resolution Result:</h4>
          <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{JSON.stringify(resolutionResult, null, 2)}</pre>
        </div>
      )}
    </div>
  );
};

export default DidResolver;
