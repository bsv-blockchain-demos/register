// src/components/DidCreator.tsx
import React, { useState } from 'react';
import WalletService from '../services/walletService';
import type { CreateDidPayload, BackendSubmitPayload, CreateDidResponse } from '../types';
import { WalletClient } from '@bsv/sdk';

const DID_TOPIC_NAME = 'tm_qdid'; // From didService.ts, used for constructing DID

// Create a mock wallet service instance for demo purposes
const walletService = new WalletService({} as WalletClient);

const DidCreator: React.FC = () => {
  const [controllerPublicKey, setControllerPublicKey] = useState<string | null>(null);
  const [createdDid, setCreatedDid] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [creationResponse, setCreationResponse] = useState<CreateDidResponse | null>(null);

  const handleGetPublicKey = async () => {
    setIsLoading(true);
    setError(null);
    setControllerPublicKey(null);
    try {
      const pubKey = await walletService.getP2PKHControllerPublicKey();
      setControllerPublicKey(pubKey);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to get public key.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateDid = async () => {
    if (!controllerPublicKey) {
      setError('Please get a public key first.');
      return;
    }
    setIsLoading(true);
    setError(null);
    setCreatedDid(null);
    setCreationResponse(null);

    try {
      const rawTx = await walletService.createAndSignDidCreationTransaction(controllerPublicKey);

      const didPayload: CreateDidPayload = {
        operation: 'CREATE_DID',
        controllerPublicKeyHex: controllerPublicKey,
        // didDocument: { /* Optional: add minimal DID document fields if needed */ }
      };

      const submitPayload: BackendSubmitPayload = {
        transaction: rawTx,
        payload: didPayload,
      };

      const response = await fetch('http://localhost:5000/api/did/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(submitPayload),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result: CreateDidResponse = await response.json();

      setCreationResponse(result);

      // Construct the DID identifier from the first accepted output
      if (result.outputsAccepted && result.outputsAccepted.length > 0) {
        const { txid, vout } = result.outputsAccepted[0];
        // Ensure DID_TOPIC_NAME is correctly used as defined in your backend
        const didIdentifier = `did:bsv-overlay:${DID_TOPIC_NAME}:${txid}:${vout}`;
        setCreatedDid(didIdentifier);
      } else {
        setError('DID creation seemed to succeed, but no output was accepted or returned by the backend.');
      }

    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create DID.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ marginBottom: '20px', padding: '20px', border: '1px solid #eee' }}>
      <h2>Create QuarkID DID</h2>
      <button onClick={handleGetPublicKey} disabled={isLoading}>
        {isLoading && !controllerPublicKey ? 'Getting Key...' : '1. Get P2PKH Controller Public Key'}
      </button>
      {controllerPublicKey && <p>Controller Public Key: <code>{controllerPublicKey}</code></p>}
      
      {controllerPublicKey && (
        <button onClick={handleCreateDid} disabled={isLoading || !controllerPublicKey} style={{ marginTop: '10px' }}>
          {isLoading && createdDid === null ? 'Creating DID...' : '2. Create DID'}
        </button>
      )}

      {isLoading && <p>Loading...</p>}
      {error && <p style={{ color: 'red' }}>Error: {error}</p>}
      {createdDid && <p style={{ color: 'green' }}>DID Created Successfully: <code>{createdDid}</code></p>}
      {creationResponse && (
        <div style={{ marginTop: '10px', border: '1px solid #ccc', padding: '10px', background: '#f9f9f9' }}>
          <h4>Backend Response:</h4>
          <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{JSON.stringify(creationResponse, null, 2)}</pre>
        </div>
      )}
    </div>
  );
};

export default DidCreator;
