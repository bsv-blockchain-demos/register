// src/components/TokenManager.tsx
import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { apiService } from '../services/apiService';
import { qrService } from '../services/qrService';

// New VCToken interface
interface VCToken {
  id: string;
  vcId: string;
  txid: string;
  vout: number;
  status: 'active' | 'transferred' | 'finalized';
  vc: any;
  issuerDid: string;
  subjectDid: string;
  currentOwnerDid: string;
  metadata: {
    type: string;
    description: string;
    customData?: any;
  };
  tokenState: {
    createdAt: Date;
    updatedAt: Date;
    transferHistory: Array<{
      from: string;
      to: string;
      timestamp: Date;
      txid?: string;
    }>;
    finalizedAt?: Date;
  };
}

const TokenManager: React.FC = () => {
  const { state, dispatch } = useApp();
  const [selectedVCToken, setSelectedVCToken] = useState<VCToken | null>(null);
  const [vcTokens, setVCTokens] = useState<VCToken[]>([]);
  const [transferForm, setTransferForm] = useState({
    recipientDid: ''
  });
  const [isTransferring, setIsTransferring] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [tokenQRCodes, setTokenQRCodes] = useState<Record<string, string>>({});
  const [showStats, setShowStats] = useState(true);
  const [stats, setStats] = useState<any>({});

  // Load VC tokens for current actor
  useEffect(() => {
    if (state.currentActor?.did) {
      loadVCTokens();
      loadStats();
    }
  }, [state.currentActor]);

  const loadVCTokens = async () => {
    if (!state.currentActor?.did) return;
    
    setIsLoading(true);
    try {
      const response = await apiService.listVCTokens({
        currentOwnerDid: state.currentActor.did
      });
      if (response.success && response.data) {
        setVCTokens(response.data);
      }
    } catch (error) {
      console.error('Failed to load VC tokens:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const response = await apiService.getVCTokenStats();
      if (response.success && response.data) {
        setStats(response.data);
      }
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  };

  const handleTransferVCToken = async (token: VCToken) => {
    if (!state.currentActor) {
      alert('Please select an actor first');
      return;
    }

    if (!transferForm.recipientDid) {
      alert('Please enter recipient DID');
      return;
    }

    const recipient = state.actors.find(a => a.did === transferForm.recipientDid);
    if (!recipient) {
      alert('Recipient actor not found');
      return;
    }

    setIsTransferring(true);
    try {
      const response = await apiService.transferVCToken({
        tokenId: token.id,
        fromDid: state.currentActor.did!,
        toDid: transferForm.recipientDid,
        metadata: {
          transferredAt: new Date().toISOString(),
          recipientName: recipient.name
        }
      });

      if (response.success) {
        // Reload tokens to reflect changes
        await loadVCTokens();
        
        // Reset form
        setTransferForm({ recipientDid: '' });
        setSelectedVCToken(null);

        alert(`VC Token transferred successfully to ${recipient.name}`);
      } else {
        throw new Error(response.error || 'Transfer failed');
      }
    } catch (error) {
      console.error('VC Token transfer failed:', error);
      alert('Failed to transfer VC token');
    } finally {
      setIsTransferring(false);
    }
  };

  const generateVCTokenQR = async (token: VCToken) => {
    if (!state.currentActor) {
      alert('Please select an actor first');
      return;
    }

    try {
      // For now, create a simple QR with token ID - you can enhance this later
      const qrData = {
        tokenId: token.id,
        vcId: token.vcId,
        currentOwner: token.currentOwnerDid,
        type: token.metadata.type
      };
      const qrCode = await qrService.generateQR(JSON.stringify(qrData));
      setTokenQRCodes(prev => ({ ...prev, [token.id]: qrCode }));
    } catch (error) {
      console.error('QR generation failed:', error);
      alert('Failed to generate QR code');
    }
  };

  const getVCTokenStatusColor = (status: VCToken['status']): string => {
    switch (status) {
      case 'active': return 'green';
      case 'transferred': return 'orange';
      case 'finalized': return 'blue';
      default: return 'gray';
    }
  };

  const getVCTokenTypeIcon = (type: string): string => {
    if (type === 'PrescriptionCredential') return '💊';
    if (type === 'PaymentCredential') return '💰';
    if (type === 'IdentityCredential') return '🆔';
    return '🎫';
  };

  const formatDate = (dateString: string | Date): string => {
    return new Date(dateString).toLocaleDateString();
  };

  return (
    <div className="token-manager">
      <div className="page-header">
        <h2>🎫 VC Token Manager</h2>
        <p>Monitor and manage Verifiable Credential tokens with BSV integration</p>
      </div>

      {!state.currentActor && (
        <div className="warning-banner">
          <div className="warning-icon">⚠️</div>
          <div className="warning-content">
            <h4>No Actor Selected</h4>
            <p>Please select an actor to view and manage your tokens</p>
          </div>
        </div>
      )}

      {/* VC Token Statistics */}
      {showStats && (
        <div className="stats-section">
          <div className="stats-header">
            <h3>📊 VC Token Statistics</h3>
            <button 
              className="toggle-button"
              onClick={() => setShowStats(!showStats)}
            >
              {showStats ? '➖' : '➕'}
            </button>
          </div>
          
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-icon">🎫</div>
              <div className="stat-value">{stats.total || 0}</div>
              <div className="stat-label">Total VC Tokens</div>
            </div>
            <div className="stat-card">
              <div className="stat-icon">✅</div>
              <div className="stat-value">{stats.byStatus?.active || 0}</div>
              <div className="stat-label">Active</div>
            </div>
            <div className="stat-card">
              <div className="stat-icon">🔄</div>
              <div className="stat-value">{stats.byStatus?.transferred || 0}</div>
              <div className="stat-label">Transferred</div>
            </div>
            <div className="stat-card">
              <div className="stat-icon">✅</div>
              <div className="stat-value">{stats.byStatus?.finalized || 0}</div>
              <div className="stat-label">Finalized</div>
            </div>
          </div>
        </div>
      )}

      {/* Current Actor VC Tokens */}
      {state.currentActor && (
        <div className="user-tokens-section">
          <h3>💼 Your VC Tokens</h3>
          {isLoading ? (
            <div className="loading-state">
              <div className="loading-icon">⏳</div>
              <p>Loading your VC tokens...</p>
            </div>
          ) : vcTokens.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">🎫</div>
              <h4>No VC Tokens</h4>
              <p>You don't have any VC tokens yet. Create a prescription to generate tokens.</p>
            </div>
          ) : (
            <div className="tokens-grid">
              {vcTokens.map(token => (
                <div key={token.id} className="token-card">
                  <div className="token-header">
                    <div className="token-icon">
                      {getVCTokenTypeIcon(token.metadata.type)}
                    </div>
                    <div className="token-info">
                      <h4>VC Token #{token.id.slice(-6)}</h4>
                      <span 
                        className="status-badge"
                        style={{ backgroundColor: getVCTokenStatusColor(token.status) }}
                      >
                        {token.status}
                      </span>
                    </div>
                  </div>

                  <div className="token-details">
                    <div className="detail-row">
                      <span className="label">Type:</span>
                      <span className="value">{token.metadata.type}</span>
                    </div>
                    <div className="detail-row">
                      <span className="label">Description:</span>
                      <span className="value">{token.metadata.description}</span>
                    </div>
                    <div className="detail-row">
                      <span className="label">VC ID:</span>
                      <span className="value txid-value">{token.vcId}</span>
                    </div>
                    <div className="detail-row">
                      <span className="label">BSV TXID:</span>
                      <span className="value txid-value">{token.txid}</span>
                    </div>
                    <div className="detail-row">
                      <span className="label">Created:</span>
                      <span className="value">
                        {formatDate(token.tokenState.createdAt)}
                      </span>
                    </div>
                    <div className="detail-row">
                      <span className="label">Current Owner:</span>
                      <span className="value">
                        {state.actors.find(a => a.did === token.currentOwnerDid)?.name || 'Unknown'}
                      </span>
                    </div>

                    {token.tokenState.transferHistory && token.tokenState.transferHistory.length > 0 && (
                      <div className="transfer-history">
                        <h5>📜 Transfer History</h5>
                        <div className="history-list">
                          {token.tokenState.transferHistory.slice(-3).map((transfer, index) => (
                            <div key={index} className="history-item">
                              <span className="transfer-date">
                                {formatDate(transfer.timestamp)}
                              </span>
                              <span className="transfer-arrow">→</span>
                              <span className="transfer-to">
                                {state.actors.find(a => a.did === transfer.to)?.name || 'Unknown'}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="token-actions">
                    <button
                      className="action-button transfer"
                      onClick={() => setSelectedVCToken(token)}
                      disabled={token.status === 'finalized'}
                    >
                      🔄 Transfer
                    </button>
                    <button
                      className="action-button qr"
                      onClick={() => generateVCTokenQR(token)}
                    >
                      📱 QR Code
                    </button>
                  </div>

                  {tokenQRCodes[token.id] && (
                    <div className="token-qr-section">
                      <h5>📱 VC Token QR Code</h5>
                      <img 
                        src={tokenQRCodes[token.id]} 
                        alt={`QR code for VC token ${token.id}`}
                        className="qr-code-image"
                      />
                      <p className="qr-help">
                        Scan to view or transfer this VC token
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}


      {/* Transfer Modal */}
      {selectedVCToken && (
        <div className="transfer-modal-overlay">
          <div className="transfer-modal">
            <div className="modal-header">
              <h3>🔄 Transfer VC Token</h3>
              <button 
                className="close-button"
                onClick={() => setSelectedVCToken(null)}
              >
                ✕
              </button>
            </div>

            <div className="modal-content">
              <div className="token-summary">
                <h4>VC Token Details</h4>
                <div className="summary-grid">
                  <div className="summary-item">
                    <span className="label">Token ID:</span>
                    <span className="value">#{selectedVCToken.id.slice(-6)}</span>
                  </div>
                  <div className="summary-item">
                    <span className="label">Type:</span>
                    <span className="value">{selectedVCToken.metadata.type}</span>
                  </div>
                  <div className="summary-item">
                    <span className="label">Status:</span>
                    <span className="value">{selectedVCToken.status}</span>
                  </div>
                </div>
              </div>

              <div className="transfer-form">
                <div className="form-group">
                  <label htmlFor="recipient-select">Recipient</label>
                  <select
                    id="recipient-select"
                    value={transferForm.recipientDid}
                    onChange={(e) => setTransferForm(prev => ({ ...prev, recipientDid: e.target.value }))}
                  >
                    <option value="">Select recipient</option>
                    {state.actors
                      .filter(actor => actor.did !== state.currentActor?.did)
                      .map(actor => (
                        <option key={actor.id} value={actor.did}>
                          {actor.name} ({actor.type})
                        </option>
                      ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="modal-actions">
              <button
                className="secondary-button"
                onClick={() => setSelectedVCToken(null)}
              >
                Cancel
              </button>
              <button
                className="primary-button"
                onClick={() => handleTransferVCToken(selectedVCToken)}
                disabled={isTransferring || !transferForm.recipientDid}
              >
                {isTransferring ? '⏳ Transferring...' : '🔄 Transfer VC Token'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Info Section */}
      <div className="info-section">
        <h3>ℹ️ About VC Tokens</h3>
        <div className="info-content">
          <p>
            VC Tokens combine Verifiable Credentials with BSV blockchain tokens, creating a unified system for 
            prescription ownership and transfer rights. Each prescription is both a verifiable credential and 
            a blockchain token that can be securely transferred between actors.
          </p>
          
          <div className="info-features">
            <div className="feature-item">
              <span className="feature-icon">🔒</span>
              <span className="feature-text">Cryptographically secured with W3C VCs and BSV blockchain</span>
            </div>
            <div className="feature-item">
              <span className="feature-icon">🔄</span>
              <span className="feature-text">Atomic operations ensure VC and token consistency</span>
            </div>
            <div className="feature-item">
              <span className="feature-icon">📊</span>
              <span className="feature-text">Full transaction history and verifiable provenance</span>
            </div>
            <div className="feature-item">
              <span className="feature-icon">⚡</span>
              <span className="feature-text">Simplified single-step creation and management</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TokenManager;
