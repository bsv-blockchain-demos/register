// src/App.tsx
// src/App.tsx
import React, { useState } from 'react';
import './App.css'; // Assuming this file exists and might have relevant styles
import { walletService } from './services/walletService';
import { didService } from './services/didService';
// Corrected: Use 'import type' for type-only imports
import type { CreateDidPayload, BackendSubmitPayload, CreateDidResponse } from './types';

function App() {
  const [controllerPublicKey, setControllerPublicKey] = useState<string | null>(null);
  const [createdDoctorDid, setCreatedDoctorDid] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [creationResponse, setCreationResponse] = useState<CreateDidResponse | null>(null);

  const handleGetPublicKey = async () => {
    setIsLoading(true);
    setError(null);
    setControllerPublicKey(null);
    setCreatedDoctorDid(null);
    setCreationResponse(null);
    try {
      const pubKey = await walletService.getP2PKHControllerPublicKey();
      setControllerPublicKey(pubKey);
    } catch (err: unknown) { // Corrected: Use 'unknown'
      if (err instanceof Error) {
        setError(err.message || 'Failed to get public key from Wallet Toolbox.');
      } else {
        setError('An unknown error occurred while getting public key.');
      }
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateDoctorDid = async () => {
    if (!controllerPublicKey) {
      setError('Please get a public key first.');
      return;
    }
    setIsLoading(true);
    setError(null);
    setCreatedDoctorDid(null);
    setCreationResponse(null);

    try {
      const rawTx = await walletService.createAndSignDidCreationTransaction(controllerPublicKey);

      const didPayload: CreateDidPayload = {
        operation: 'CREATE_DID',
        controllerPublicKeyHex: controllerPublicKey,
      };

      const submitPayload: BackendSubmitPayload = {
        transaction: rawTx,
        payload: didPayload,
      };

      const response = await didService.createDid(submitPayload);
      setCreationResponse(response);

      if (response.outputsAccepted && response.outputsAccepted.length > 0) {
        const { txid, vout } = response.outputsAccepted[0];
        const didIdentifier = `did:bsv-overlay:tm_qdid:${txid}:${vout}`;
        setCreatedDoctorDid(didIdentifier);
      } else {
        setError('DID creation seemed to succeed, but no output was accepted or returned by the backend.');
      }

    } catch (err: unknown) { // Corrected: Use 'unknown'
      if (err instanceof Error) {
        setError(err.message || 'Failed to create Doctor\'s DID.');
      } else {
        setError('An unknown error occurred while creating Doctor\'s DID.');
      }
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <h1>Register Doctor's DID (using QuarkID & Wallet Toolbox)</h1>
      
      <div style={{ marginBottom: '20px', padding: '20px', border: '1px solid #eee' }}>
        <h3>Step 1: Get Public Key for Doctor's DID</h3>
        <button onClick={handleGetPublicKey} disabled={isLoading}>
          {isLoading && !controllerPublicKey ? 'Getting Key...' : 'Get P2PKH Controller Public Key'}
        </button>
        {controllerPublicKey && <p>Controller Public Key: <code>{controllerPublicKey}</code></p>}
      </div>

      {controllerPublicKey && (
        <div style={{ marginBottom: '20px', padding: '20px', border: '1px solid #eee' }}>
          <h3>Step 2: Create Doctor's DID</h3>
          <button onClick={handleCreateDoctorDid} disabled={isLoading || !controllerPublicKey}>
            {isLoading && createdDoctorDid === null ? 'Creating DID...' : 'Create Doctor\'s DID'}
          </button>
        </div>
      )}

      {isLoading && <p>Loading...</p>}
      {error && <p style={{ color: 'red' }}>Error: {error}</p>}
      
      {createdDoctorDid && (
        <div style={{ marginTop: '20px', padding: '10px', border: '1px solid green', background: '#e6ffe6' }}>
          <h4>Doctor's DID Created Successfully:</h4>
          <p><code>{createdDoctorDid}</code></p>
        </div>
      )}

      {creationResponse && (
        <div style={{ marginTop: '10px', border: '1px solid #ccc', padding: '10px', background: '#f9f9f9' }}>
          <h4>Backend Response:</h4>
          <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{JSON.stringify(creationResponse, null, 2)}</pre>
        </div>
      )}
    </>
  );
}

export default App;
