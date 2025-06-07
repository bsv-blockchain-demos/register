// src/services/tokenService.ts
import type { BSVToken, Actor, PrescriptionCredential } from '../types';
import { encryptionService } from './encryptionService';

/**
 * BSV Token Management Service
 * Handles creation, transfer, and verification of BSV tokens for medical prescriptions
 */
class TokenService {
  /**
   * Create a BSV token for a prescription
   */
  async createPrescriptionToken(
    prescriptionVC: PrescriptionCredential,
    patient: Actor,
    satoshis: number = 1000 // Default token value
  ): Promise<BSVToken> {
    if (!patient.did || !patient.privateKey) {
      throw new Error('Patient must have DID and private key');
    }

    try {
      // Create token metadata
      const metadata = {
        prescriptionId: prescriptionVC.credentialSubject.prescription.id,
        medicationInfo: `${prescriptionVC.credentialSubject.prescription.medication.name} - ${prescriptionVC.credentialSubject.prescription.medication.dosage}`,
        batchNumber: ''
      };

      // In a real implementation, this would create an actual BSV transaction
      // For demo purposes, we'll simulate a token creation
      const token: BSVToken = {
        txid: this.generateMockTxId(),
        vout: 1,
        satoshis,
        script: this.generateP2PKHScript(patient.publicKey || ''),
        status: 'no dispensado',
        unlockableBy: patient.did,
        metadata
      };

      // Store token information (in production, this would be on-chain)
      await this.storeTokenInfo(token);

      return token;
    } catch (error) {
      console.error('Token creation failed:', error);
      throw new Error('Failed to create prescription token');
    }
  }

  /**
   * Transfer token to pharmacy
   */
  async transferTokenToPharmacy(
    token: BSVToken,
    pharmacy: Actor,
    patient: Actor
  ): Promise<BSVToken> {
    if (!pharmacy.did || !patient.privateKey) {
      throw new Error('Invalid pharmacy DID or patient private key');
    }

    try {
      // Create new token with updated ownership
      const updatedToken: BSVToken = {
        ...token,
        txid: this.generateMockTxId(), // New transaction
        unlockableBy: pharmacy.did,
        script: this.generateP2PKHScript(pharmacy.publicKey || '')
      };

      // Store updated token info
      await this.storeTokenInfo(updatedToken);

      return updatedToken;
    } catch (error) {
      console.error('Token transfer failed:', error);
      throw new Error('Failed to transfer token to pharmacy');
    }
  }

  /**
   * Update token status after dispensation
   */
  async updateTokenStatus(
    token: BSVToken,
    newStatus: 'no dispensado' | 'dispensado',
    batchNumber?: string
  ): Promise<BSVToken> {
    try {
      const updatedToken: BSVToken = {
        ...token,
        status: newStatus,
        metadata: {
          ...token.metadata,
          batchNumber: batchNumber || token.metadata?.batchNumber || ''
        }
      };

      // Store updated token info
      await this.storeTokenInfo(updatedToken);

      return updatedToken;
    } catch (error) {
      console.error('Token status update failed:', error);
      throw new Error('Failed to update token status');
    }
  }

  /**
   * Verify token ownership
   */
  verifyTokenOwnership(token: BSVToken, actor: Actor): boolean {
    return token.unlockableBy === actor.did;
  }

  /**
   * Get tokens for a specific DID
   */
  async getTokensForDID(did: string): Promise<BSVToken[]> {
    try {
      // In production, this would query the blockchain/overlay
      const storedTokens = this.getStoredTokens();
      return storedTokens.filter(token => token.unlockableBy === did);
    } catch (error) {
      console.error('Failed to get tokens:', error);
      return [];
    }
  }

  /**
   * Get token by transaction ID and output index
   */
  async getToken(txid: string, vout: number): Promise<BSVToken | null> {
    try {
      const storedTokens = this.getStoredTokens();
      return storedTokens.find(token => 
        token.txid === txid && token.vout === vout
      ) || null;
    } catch (error) {
      console.error('Failed to get token:', error);
      return null;
    }
  }

  /**
   * Check if token can be spent by actor
   */
  canSpendToken(token: BSVToken, actor: Actor): boolean {
    return (
      this.verifyTokenOwnership(token, actor) &&
      actor.privateKey !== undefined
    );
  }

  /**
   * Generate token history for audit trail
   */
  generateTokenHistory(token: BSVToken): Array<{
    action: string;
    timestamp: string;
    actor: string;
    details: string;
  }> {
    // In production, this would be derived from blockchain transactions
    return [
      {
        action: 'Created',
        timestamp: new Date().toISOString(),
        actor: token.unlockableBy,
        details: `Token created for prescription ${token.metadata?.prescriptionId}`
      }
    ];
  }

  /**
   * Validate token structure
   */
  validateToken(token: BSVToken): boolean {
    return (
      typeof token.txid === 'string' &&
      token.txid.length === 64 &&
      typeof token.vout === 'number' &&
      token.vout >= 0 &&
      typeof token.satoshis === 'number' &&
      token.satoshis > 0 &&
      typeof token.script === 'string' &&
      typeof token.unlockableBy === 'string' &&
      (token.status === 'no dispensado' || token.status === 'dispensado')
    );
  }

  // Private helper methods

  /**
   * Generate a mock transaction ID for demo purposes
   */
  private generateMockTxId(): string {
    return encryptionService.hash(Date.now().toString() + Math.random().toString());
  }

  /**
   * Generate a P2PKH script for a public key
   */
  private generateP2PKHScript(publicKey: string): string {
    // Simplified P2PKH script generation
    // In production, would use proper BSV script generation
    const pubKeyHash = encryptionService.hash(publicKey).substring(0, 40);
    return `76a914${pubKeyHash}88ac`;
  }

  /**
   * Store token information locally (demo implementation)
   */
  private async storeTokenInfo(token: BSVToken): Promise<void> {
    try {
      const existingTokens = this.getStoredTokens();
      const updatedTokens = [
        ...existingTokens.filter(t => !(t.txid === token.txid && t.vout === token.vout)),
        token
      ];
      
      localStorage.setItem('bsv_tokens', JSON.stringify(updatedTokens));
    } catch (error) {
      console.error('Failed to store token info:', error);
      throw error;
    }
  }

  /**
   * Get stored tokens from local storage
   */
  private getStoredTokens(): BSVToken[] {
    try {
      const stored = localStorage.getItem('bsv_tokens');
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Failed to get stored tokens:', error);
      return [];
    }
  }

  /**
   * Clear all stored tokens (for testing)
   */
  clearStoredTokens(): void {
    localStorage.removeItem('bsv_tokens');
  }

  /**
   * Get token statistics
   */
  getTokenStats(): {
    total: number;
    active: number;
    dispensed: number;
    totalValue: number;
  } {
    const tokens = this.getStoredTokens();
    
    return {
      total: tokens.length,
      active: tokens.filter(t => t.status === 'no dispensado').length,
      dispensed: tokens.filter(t => t.status === 'dispensado').length,
      totalValue: tokens.reduce((sum, token) => sum + token.satoshis, 0)
    };
  }

  /**
   * Estimate transaction fee for token operations
   */
  estimateTransactionFee(): number {
    // Simplified fee estimation (in satoshis)
    return 1000; // ~1000 satoshis for a typical transaction
  }
}

export const tokenService = new TokenService();
