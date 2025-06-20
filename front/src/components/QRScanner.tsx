// src/components/QRScanner.tsx
import React, { useState, useEffect, useRef } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { qrService } from '../services/qrService';
import { apiService } from '../services/apiService';
import type { QRCodeData, VerifiableCredential, PrescriptionCredential } from '../types';

const QRScanner: React.FC = () => {
  const { state, dispatch } = useApp();
  const navigate = useNavigate();
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<string | null>(null);
  const [parsedData, setParsedData] = useState<QRCodeData | null>(null);
  const [decryptedVC, setDecryptedVC] = useState<VerifiableCredential | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [manualInput, setManualInput] = useState('');
  const [showManualInput, setShowManualInput] = useState(false);
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);
  const scannerElementRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return () => {
      // Cleanup scanner on unmount
      if (scannerRef.current) {
        scannerRef.current.clear().catch(console.error);
      }
    };
  }, []);

  const startScanning = () => {
    if (!scannerElementRef.current) return;

    setIsScanning(true);
    setError(null);
    setScanResult(null);
    setParsedData(null);
    setDecryptedVC(null);

    scannerRef.current = new Html5QrcodeScanner(
      "qr-reader",
      { 
        fps: 10, 
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0
      },
      false
    );

    scannerRef.current.render(
      (decodedText) => {
        handleScanSuccess(decodedText);
      },
      (error) => {
        // Ignore frequent scan errors
        if (!error.includes('No MultiFormat Readers')) {
          console.warn('QR scan error:', error);
        }
      }
    );
  };

  const stopScanning = () => {
    if (scannerRef.current) {
      scannerRef.current.clear().catch(console.error);
      scannerRef.current = null;
    }
    setIsScanning(false);
  };

  const handleScanSuccess = (decodedText: string) => {
    setScanResult(decodedText);
    stopScanning();
    processQRData(decodedText);
  };

  const processQRData = async (qrText: string) => {
    try {
      setError(null);
      
      // Try to parse as QR code data
      const qrData = qrService.parseQRData(qrText);
      setParsedData(qrData);

      // Handle different QR code types
      if (qrData.type === 'actor_did') {
        handleActorDID(qrData);
      } else if (qrData.type === 'prescription_vc') {
        await handlePrescriptionVC(qrData);
      } else if (qrData.type === 'token_transfer') {
        handleTokenTransfer();
      } else {
        setError(`Unknown QR code type: ${qrData.type}`);
      }
    } catch (err) {
      console.error('QR processing failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to process QR code');
    }
  };

  const handleActorDID = (qrData: QRCodeData) => {
    const did = qrData.data.did;
    if (typeof did === 'string') {
      // Navigate to DID Resolver with the scanned DID
      navigate('/did-resolver', { state: { scannedDid: did } });
    }
  };

  const handlePrescriptionVC = async (qrData: QRCodeData) => {
    if (!state.currentActor) {
      setError('Please select an actor first');
      return;
    }

    try {
      // Send encrypted QR data to backend for decryption
      const response = await apiService.decryptQRCode({
        actorId: state.currentActor.id,
        qrData: qrData
      });

      if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to decrypt QR code');
      }

      const vcData = response.data;
      
      // Type guard to check if it's a valid VC structure
      if (typeof vcData === 'object' && vcData !== null && 'id' in vcData && 'type' in vcData) {
        // Cast to VerifiableCredential for setDecryptedVC
        const vc = vcData as VerifiableCredential;
        setDecryptedVC(vc);
        
        // Check if it's a PrescriptionCredential
        const types = Array.isArray(vc.type) ? vc.type : [vc.type];
        const isPrescriptionCredential = types.some(t => 
          typeof t === 'string' && t.includes('PrescriptionCredential')
        );

        if (isPrescriptionCredential && vc.id) {
          // Check if already exists
          const existingVC = state.prescriptions.find(p => p.id === vc.id);
          if (!existingVC) {
            // Double cast through unknown for PrescriptionCredential
            dispatch({ type: 'ADD_PRESCRIPTION', payload: vcData as unknown as PrescriptionCredential });
            setError('Prescription VC imported successfully');
          } else {
            setError('Prescription VC already exists');
          }
        } else {
          setError('Invalid credential type - expected PrescriptionCredential');
        }
      } else {
        setError('Invalid Verifiable Credential structure');
      }
    } catch (err) {
      setError(`Failed to decrypt VC: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const handleTokenTransfer = () => {
    // Handle BSV token transfer
    setError('Token transfer QR codes are not yet implemented');
  };

  const handleManualInput = () => {
    if (!manualInput.trim()) {
      setError('Please enter QR code data');
      return;
    }

    processQRData(manualInput);
  };

  const clearResults = () => {
    setScanResult(null);
    setParsedData(null);
    setDecryptedVC(null);
    setError(null);
    setManualInput('');
  };

  return (
    <div className="qr-scanner">
      <div className="page-header">
        <h2>📱 QR Code Scanner</h2>
        <p>Scan QR codes to import DIDs, Verifiable Credentials, and BSV tokens</p>
      </div>

      {!state.currentActor && (
        <div className="warning-banner">
          <div className="warning-icon">⚠️</div>
          <div className="warning-content">
            <h4>No Actor Selected</h4>
            <p>Please select an actor in Actor Management to decrypt VCs from QR codes</p>
          </div>
        </div>
      )}

      <div className="scanner-controls">
        <div className="control-buttons">
          {!isScanning ? (
            <button className="primary-button" onClick={startScanning}>
              📷 Start Camera Scanner
            </button>
          ) : (
            <button className="secondary-button" onClick={stopScanning}>
              ⏹️ Stop Scanner
            </button>
          )}
          
          <button 
            className="secondary-button"
            onClick={() => setShowManualInput(!showManualInput)}
          >
            ⌨️ Manual Input
          </button>

          {(scanResult || parsedData || error) && (
            <button className="tertiary-button" onClick={clearResults}>
              🗑️ Clear Results
            </button>
          )}
        </div>
      </div>

      {showManualInput && (
        <div className="manual-input-section">
          <div className="manual-input-form">
            <h4>📝 Manual QR Code Input</h4>
            <textarea
              value={manualInput}
              onChange={(e) => setManualInput(e.target.value)}
              placeholder="Paste QR code data here..."
              rows={4}
              className="manual-input-field"
            />
            <div className="manual-input-actions">
              <button 
                className="primary-button"
                onClick={handleManualInput}
                disabled={!manualInput.trim()}
              >
                🔍 Process Data
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="scanner-area">
        {isScanning && (
          <div className="scanner-container">
            <div id="qr-reader" ref={scannerElementRef}></div>
            <p className="scanner-help">
              Position the QR code within the camera frame to scan
            </p>
          </div>
        )}
      </div>

      {/* Results Section */}
      <div className="scan-results">
        {error && (
          <div className="result-card error-card">
            <div className="result-header">
              <span className="result-icon">❌</span>
              <h4>Scan Error</h4>
            </div>
            <div className="result-content">
              <p>{error}</p>
            </div>
          </div>
        )}

        {scanResult && (
          <div className="result-card">
            <div className="result-header">
              <span className="result-icon">✅</span>
              <h4>Raw Scan Result</h4>
            </div>
            <div className="result-content">
              <pre className="scan-data">{scanResult}</pre>
            </div>
          </div>
        )}

        {parsedData && (
          <div className="result-card">
            <div className="result-header">
              <span className="result-icon">🔍</span>
              <h4>Parsed QR Data</h4>
            </div>
            <div className="result-content">
              <div className="parsed-data">
                <div className="data-row">
                  <span className="label">Type:</span>
                  <span className="value type-badge type-{parsedData.type}">
                    {parsedData.type.replace('_', ' ')}
                  </span>
                </div>
                <div className="data-row">
                  <span className="label">Timestamp:</span>
                  <span className="value">
                    {new Date(parsedData.timestamp).toLocaleString()}
                  </span>
                </div>
                
                {parsedData.type === 'actor_did' && parsedData.data.did && (
                  <div className="data-row">
                    <span className="label">DID:</span>
                    <span className="value did-value">{parsedData.data.did as string}</span>
                  </div>
                )}

                {parsedData.type === 'prescription_vc' && (
                  <div className="data-row">
                    <span className="label">Encrypted:</span>
                    <span className="value">
                      {parsedData.data.encryptedWith ? 'Yes' : 'No'}
                    </span>
                  </div>
                )}

                {parsedData.type === 'token_transfer' && parsedData.data.tokenData && (
                  <div className="data-row">
                    <span className="label">Token ID:</span>
                    <span className="value">
                      {(parsedData.data.tokenData as unknown as { txid?: string }).txid?.slice(0, 8) || 'N/A'}...
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {decryptedVC && (
          <div className="result-card success-card">
            <div className="result-header">
              <span className="result-icon">🏥</span>
              <h4>Decrypted Verifiable Credential</h4>
            </div>
            <div className="result-content">
              <div className="vc-summary">
                <div className="vc-row">
                  <span className="label">Type:</span>
                  <span className="value">{decryptedVC.type.join(', ')}</span>
                </div>
                <div className="vc-row">
                  <span className="label">Issuer:</span>
                  <span className="value">{decryptedVC.issuer}</span>
                </div>
                <div className="vc-row">
                  <span className="label">Subject:</span>
                  <span className="value">{String(decryptedVC.credentialSubject.id || 'N/A')}</span>
                </div>
                <div className="vc-row">
                  <span className="label">Issued:</span>
                  <span className="value">
                    {new Date(decryptedVC.issuanceDate).toLocaleString()}
                  </span>
                </div>
                
                {/* Show prescription details if available */}
                {(decryptedVC.credentialSubject as Record<string, unknown>).prescription ? (
                  <div className="prescription-details">
                    <h5>💊 Prescription Details</h5>
                    <div className="prescription-grid">
                      <div className="prescription-item">
                        <span className="label">Medication:</span>
                        <span className="value">{String(((decryptedVC.credentialSubject as Record<string, unknown>).prescription as Record<string, unknown>).medication || 'N/A')}</span>
                      </div>
                      <div className="prescription-item">
                        <span className="label">Dosage:</span>
                        <span className="value">{String(((decryptedVC.credentialSubject as Record<string, unknown>).prescription as Record<string, unknown>).dosage || 'N/A')}</span>
                      </div>
                      <div className="prescription-item">
                        <span className="label">Quantity:</span>
                        <span className="value">{String(((decryptedVC.credentialSubject as Record<string, unknown>).prescription as Record<string, unknown>).quantity || 'N/A')}</span>
                      </div>
                      <div className="prescription-item full-width">
                        <span className="label">Instructions:</span>
                        <span className="value">{String(((decryptedVC.credentialSubject as Record<string, unknown>).prescription as Record<string, unknown>).instructions || 'N/A')}</span>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
              
              <details className="vc-details">
                <summary>View Full VC JSON</summary>
                <pre className="vc-json">{JSON.stringify(decryptedVC, null, 2)}</pre>
              </details>
            </div>
          </div>
        )}
      </div>

      {/* Instructions */}
      <div className="instructions-section">
        <h3>📋 QR Code Types</h3>
        <div className="instructions-grid">
          <div className="instruction-card">
            <div className="instruction-icon">👤</div>
            <h4>Actor DID</h4>
            <p>Contains a decentralized identifier for sharing between actors</p>
          </div>
          <div className="instruction-card">
            <div className="instruction-icon">💊</div>
            <h4>Prescription VC</h4>
            <p>Encrypted verifiable credential containing prescription details</p>
          </div>
          <div className="instruction-card">
            <div className="instruction-icon">🪙</div>
            <h4>Token Transfer</h4>
            <p>BSV token transfer information for blockchain transactions</p>
          </div>
        </div>

        <div className="security-note">
          <div className="security-icon">🔒</div>
          <div className="security-content">
            <h4>Security Note</h4>
            <p>
              Verifiable Credentials are encrypted with your public key. Only you can decrypt 
              and view the contents using your private key stored locally.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QRScanner;
