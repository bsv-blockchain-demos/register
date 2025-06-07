// src/components/TokenManager.tsx
import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { tokenService } from '../services/tokenService';
import { qrService } from '../services/qrService';
import type { BSVToken } from '../types';

const TokenManager: React.FC = () => {
  const { state, dispatch, getCurrentTokens } = useApp();
  const [selectedToken, setSelectedToken] = useState<BSVToken | null>(null);
  const [transferForm, setTransferForm] = useState({
    recipientDid: '',
    amount: 0
  });
  const [isTransferring, setIsTransferring] = useState(false);
  const [tokenQRCodes, setTokenQRCodes] = useState<Record<string, string>>({});
  const [showStats, setShowStats] = useState(true);

  const currentTokens = getCurrentTokens();
  const allTokens = state.tokens;

  const handleTransferToken = async (token: BSVToken) => {
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
      const transferredToken = await tokenService.transferToken(token, transferForm.recipientDid);
      dispatch({ type: 'UPDATE_TOKEN', payload: transferredToken });

      // Reset form
      setTransferForm({
        recipientDid: '',
        amount: 0
      });
      setSelectedToken(null);

      alert(`Token transferred successfully to ${recipient.name}`);
    } catch (error) {
      console.error('Token transfer failed:', error);
      alert('Failed to transfer token');
    } finally {
      setIsTransferring(false);
    }
  };

  const generateTokenQR = async (token: BSVToken) => {
    if (!state.currentActor) {
      alert('Please select an actor first');
      return;
    }

    try {
      const qrCode = await qrService.generateTokenQR(token, state.currentActor.did);
      setTokenQRCodes(prev => ({ ...prev, [`${token.txid}:${token.vout}`]: qrCode }));
    } catch (error) {
      console.error('QR generation failed:', error);
      alert('Failed to generate QR code');
    }
  };

  const getTokenStats = () => {
    const stats = tokenService.getTokenStats(allTokens);
    return stats;
  };

  const formatBSVAmount = (satoshis: number): string => {
    return (satoshis / 100000000).toFixed(8) + ' BSV';
  };

  const getStatusColor = (status: BSVToken['status']): string => {
    switch (status) {
      case 'active': return 'green';
      case 'pending': return 'orange';
      case 'completed': return 'blue';
      case 'expired': return 'red';
      default: return 'gray';
    }
  };

  const getTokenTypeIcon = (metadata?: BSVToken['metadata']): string => {
    if (metadata?.prescriptionId) return '💊';
    if (metadata?.type === 'payment') return '💰';
    return '🪙';
  };

  const stats = getTokenStats();

  return (
    <div className="token-manager">
      <div className="page-header">
        <h2>🪙 BSV Token Manager</h2>
        <p>Monitor and manage Bitcoin SV tokens for medical prescriptions</p>
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

      {/* Token Statistics */}
      {showStats && (
        <div className="stats-section">
          <div className="stats-header">
            <h3>📊 Token Statistics</h3>
            <button 
              className="toggle-button"
              onClick={() => setShowStats(!showStats)}
            >
              {showStats ? '➖' : '➕'}
            </button>
          </div>
          
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-icon">🪙</div>
              <div className="stat-value">{stats.total}</div>
              <div className="stat-label">Total Tokens</div>
            </div>
            <div className="stat-card">
              <div className="stat-icon">✅</div>
              <div className="stat-value">{stats.active}</div>
              <div className="stat-label">Active</div>
            </div>
            <div className="stat-card">
              <div className="stat-icon">⏳</div>
              <div className="stat-value">{stats.pending}</div>
              <div className="stat-label">Pending</div>
            </div>
            <div className="stat-card">
              <div className="stat-icon">💰</div>
              <div className="stat-value">{formatBSVAmount(stats.totalValue)}</div>
              <div className="stat-label">Total Value</div>
            </div>
          </div>
        </div>
      )}

      {/* Current Actor Tokens */}
      {state.currentActor && (
        <div className="user-tokens-section">
          <h3>💼 Your Tokens</h3>
          {currentTokens.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">🪙</div>
              <h4>No Tokens</h4>
              <p>You don't have any tokens yet. Create a prescription to generate tokens.</p>
            </div>
          ) : (
            <div className="tokens-grid">
              {currentTokens.map(token => (
                <div key={`${token.txid}:${token.vout}`} className="token-card">
                  <div className="token-header">
                    <div className="token-icon">
                      {getTokenTypeIcon(token.metadata)}
                    </div>
                    <div className="token-info">
                      <h4>Token #{token.txid.slice(-6)}</h4>
                      <span 
                        className="status-badge"
                        style={{ backgroundColor: getStatusColor(token.status) }}
                      >
                        {token.status}
                      </span>
                    </div>
                  </div>

                  <div className="token-details">
                    <div className="detail-row">
                      <span className="label">Value:</span>
                      <span className="value">{formatBSVAmount(token.value)}</span>
                    </div>
                    <div className="detail-row">
                      <span className="label">TXID:</span>
                      <span className="value txid-value">{token.txid}</span>
                    </div>
                    <div className="detail-row">
                      <span className="label">Output:</span>
                      <span className="value">{token.vout}</span>
                    </div>
                    <div className="detail-row">
                      <span className="label">Created:</span>
                      <span className="value">
                        {new Date(token.createdAt).toLocaleDateString()}
                      </span>
                    </div>

                    {token.metadata?.prescriptionId && (
                      <div className="detail-row">
                        <span className="label">Prescription:</span>
                        <span className="value">#{token.metadata.prescriptionId.slice(-6)}</span>
                      </div>
                    )}

                    {token.transferHistory && token.transferHistory.length > 0 && (
                      <div className="transfer-history">
                        <h5>📜 Transfer History</h5>
                        <div className="history-list">
                          {token.transferHistory.slice(-3).map((transfer, index) => (
                            <div key={index} className="history-item">
                              <span className="transfer-date">
                                {new Date(transfer.timestamp).toLocaleDateString()}
                              </span>
                              <span className="transfer-arrow">→</span>
                              <span className="transfer-to">
                                {state.actors.find(a => a.did === transfer.toDid)?.name || 'Unknown'}
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
                      onClick={() => setSelectedToken(token)}
                      disabled={token.status !== 'active'}
                    >
                      🔄 Transfer
                    </button>
                    <button
                      className="action-button qr"
                      onClick={() => generateTokenQR(token)}
                    >
                      📱 QR Code
                    </button>
                  </div>

                  {tokenQRCodes[`${token.txid}:${token.vout}`] && (
                    <div className="token-qr-section">
                      <h5>📱 Token QR Code</h5>
                      <img 
                        src={tokenQRCodes[`${token.txid}:${token.vout}`]} 
                        alt={`QR code for token ${token.txid}`}
                        className="qr-code-image"
                      />
                      <p className="qr-help">
                        Scan to transfer this token
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* All Network Tokens */}
      <div className="all-tokens-section">
        <h3>🌐 All Network Tokens</h3>
        <p>All tokens created in the medical prescription demo</p>
        
        {allTokens.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🌐</div>
            <h4>No Network Tokens</h4>
            <p>No tokens have been created yet in the system</p>
          </div>
        ) : (
          <div className="network-tokens-list">
            {allTokens.map(token => (
              <div key={`${token.txid}:${token.vout}`} className="network-token-row">
                <div className="network-token-icon">
                  {getTokenTypeIcon(token.metadata)}
                </div>
                <div className="network-token-info">
                  <div className="network-token-id">#{token.txid.slice(-6)}</div>
                  <div className="network-token-meta">
                    {formatBSVAmount(token.value)} • {token.status}
                  </div>
                </div>
                <div className="network-token-owner">
                  <div className="owner-label">Owner:</div>
                  <div className="owner-name">
                    {state.actors.find(a => a.did === token.unlockableBy)?.name || 'Unknown'}
                  </div>
                </div>
                <div className="network-token-prescription">
                  {token.metadata?.prescriptionId && (
                    <div className="prescription-link">
                      💊 Prescription #{token.metadata.prescriptionId.slice(-6)}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Transfer Modal */}
      {selectedToken && (
        <div className="transfer-modal-overlay">
          <div className="transfer-modal">
            <div className="modal-header">
              <h3>🔄 Transfer Token</h3>
              <button 
                className="close-button"
                onClick={() => setSelectedToken(null)}
              >
                ✕
              </button>
            </div>

            <div className="modal-content">
              <div className="token-summary">
                <h4>Token Details</h4>
                <div className="summary-grid">
                  <div className="summary-item">
                    <span className="label">Token ID:</span>
                    <span className="value">#{selectedToken.txid.slice(-6)}</span>
                  </div>
                  <div className="summary-item">
                    <span className="label">Value:</span>
                    <span className="value">{formatBSVAmount(selectedToken.value)}</span>
                  </div>
                  <div className="summary-item">
                    <span className="label">Status:</span>
                    <span className="value">{selectedToken.status}</span>
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

                <div className="estimated-fees">
                  <h5>📊 Transaction Estimate</h5>
                  <div className="fee-item">
                    <span>Network Fee:</span>
                    <span>{formatBSVAmount(tokenService.estimateTransactionFee())}</span>
                  </div>
                  <div className="fee-item">
                    <span>You'll Receive:</span>
                    <span>{formatBSVAmount(selectedToken.value - tokenService.estimateTransactionFee())}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="modal-actions">
              <button
                className="secondary-button"
                onClick={() => setSelectedToken(null)}
              >
                Cancel
              </button>
              <button
                className="primary-button"
                onClick={() => handleTransferToken(selectedToken)}
                disabled={isTransferring || !transferForm.recipientDid}
              >
                {isTransferring ? '⏳ Transferring...' : '🔄 Transfer Token'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Info Section */}
      <div className="info-section">
        <h3>ℹ️ About BSV Tokens</h3>
        <div className="info-content">
          <p>
            BSV tokens in this demo represent prescription ownership and transfer rights on the Bitcoin SV blockchain. 
            Each prescription is tokenized as a unique digital asset that can be securely transferred between actors.
          </p>
          
          <div className="info-features">
            <div className="feature-item">
              <span className="feature-icon">🔒</span>
              <span className="feature-text">Cryptographically secured on BSV blockchain</span>
            </div>
            <div className="feature-item">
              <span className="feature-icon">🔄</span>
              <span className="feature-text">Transferable between authorized actors</span>
            </div>
            <div className="feature-item">
              <span className="feature-icon">📊</span>
              <span className="feature-text">Full transaction history and provenance</span>
            </div>
            <div className="feature-item">
              <span className="feature-icon">⚡</span>
              <span className="feature-text">Fast and low-cost microtransactions</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TokenManager;
