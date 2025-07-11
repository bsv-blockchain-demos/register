import { API_BASE_URL } from '../config';
import type { Actor } from '../types';

/**
 * Unified VC Token combining Verifiable Credential with BSV token
 */
export interface VCToken {
  id: string;
  vcId: string;
  txid: string;
  vout: number;
  status: 'active' | 'transferred' | 'finalized';
  vc: any; // VerifiableCredential
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

/**
 * Unified service for VC Token operations
 * Simplifies the flow by combining VC and BSV token operations
 */
class VCTokenService {
  private baseUrl = `${API_BASE_URL}/vc-tokens`;

  /**
   * Create a VC Token (atomic VC + BSV token creation)
   */
  async createVCToken(params: {
    issuerDid: string;
    subjectDid: string;
    credentialType: string;
    claims: any;
    metadata?: {
      description?: string;
      customData?: any;
    };
    validFrom?: Date;
    validUntil?: Date;
  }): Promise<VCToken> {
    const response = await fetch(`${this.baseUrl}/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...params,
        validFrom: params.validFrom?.toISOString(),
        validUntil: params.validUntil?.toISOString()
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create VC token');
    }

    const result = await response.json();
    return result.data;
  }

  /**
   * Create a prescription VC Token (simplified endpoint)
   */
  async createPrescriptionToken(params: {
    doctorDid: string;
    patientDid: string;
    medicationName: string;
    dosage: string;
    quantity: number;
    instructions: string;
    diagnosisCode?: string;
    insuranceDid?: string;
    expiryDays?: number;
  }): Promise<VCToken> {
    const response = await fetch(`${this.baseUrl}/prescription/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create prescription token');
    }

    const result = await response.json();
    return result.data;
  }

  /**
   * Transfer a VC Token to a new owner
   */
  async transferToken(
    tokenId: string,
    fromDid: string,
    toDid: string,
    metadata?: any
  ): Promise<VCToken> {
    const response = await fetch(`${this.baseUrl}/transfer`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tokenId,
        fromDid,
        toDid,
        metadata
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to transfer token');
    }

    const result = await response.json();
    return result.data;
  }

  /**
   * Share prescription with pharmacy (specialized transfer)
   */
  async sharePrescriptionWithPharmacy(
    tokenId: string,
    patientDid: string,
    pharmacyDid: string
  ): Promise<VCToken> {
    return this.transferToken(
      tokenId,
      patientDid,
      pharmacyDid,
      {
        action: 'share_for_dispensing',
        timestamp: new Date().toISOString()
      }
    );
  }

  /**
   * Finalize a VC Token
   */
  async finalizeToken(
    tokenId: string,
    finalizerDid: string,
    metadata?: any
  ): Promise<VCToken> {
    const response = await fetch(`${this.baseUrl}/finalize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tokenId,
        finalizerDid,
        metadata
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to finalize token');
    }

    const result = await response.json();
    return result.data;
  }

  /**
   * Get a specific VC Token
   */
  async getToken(tokenId: string): Promise<VCToken> {
    const response = await fetch(`${this.baseUrl}/${tokenId}`);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to get token');
    }

    const result = await response.json();
    return result.data;
  }

  /**
   * List VC Tokens with filters
   */
  async listTokens(filter?: {
    issuerDid?: string;
    subjectDid?: string;
    currentOwnerDid?: string;
    type?: string;
    status?: 'active' | 'transferred' | 'finalized';
  }): Promise<VCToken[]> {
    const params = new URLSearchParams();
    if (filter) {
      Object.entries(filter).forEach(([key, value]) => {
        if (value) params.append(key, value);
      });
    }

    const response = await fetch(`${this.baseUrl}/list?${params}`);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to list tokens');
    }

    const result = await response.json();
    return result.data;
  }

  /**
   * Get tokens for a specific actor
   */
  async getTokensForActor(actorDid: string, role?: 'issuer' | 'subject' | 'owner'): Promise<VCToken[]> {
    const filter: any = {};
    
    switch (role) {
      case 'issuer':
        filter.issuerDid = actorDid;
        break;
      case 'subject':
        filter.subjectDid = actorDid;
        break;
      case 'owner':
      default:
        filter.currentOwnerDid = actorDid;
        break;
    }

    return this.listTokens(filter);
  }

  /**
   * Verify a VC Token
   */
  async verifyToken(tokenId: string): Promise<{
    valid: boolean;
    vcValid: boolean;
    tokenValid: boolean;
    errors?: string[];
  }> {
    const response = await fetch(`${this.baseUrl}/verify/${tokenId}`, {
      method: 'POST'
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to verify token');
    }

    const result = await response.json();
    return result.data;
  }

  /**
   * Get VC Token statistics
   */
  async getStatistics(): Promise<{
    total: number;
    byStatus: { active: number; transferred: number; finalized: number };
    byType: { [key: string]: number };
    byIssuer: { [key: string]: number };
  }> {
    const response = await fetch(`${this.baseUrl}/stats/summary`);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to get statistics');
    }

    const result = await response.json();
    return result.data;
  }

  /**
   * Helper: Extract prescription data from VC Token
   */
  extractPrescriptionData(token: VCToken) {
    if (token.metadata.type !== 'PrescriptionCredential') {
      throw new Error('Not a prescription token');
    }

    const claims = token.vc.credentialSubject;
    return {
      tokenId: token.id,
      prescriptionId: token.vcId,
      medication: claims.medication,
      diagnosis: claims.diagnosis,
      insurance: claims.insurance,
      prescribedAt: claims.prescribedAt,
      status: token.status,
      currentOwner: token.currentOwnerDid,
      patient: token.subjectDid,
      doctor: token.issuerDid
    };
  }

  /**
   * Helper: Format token for display
   */
  formatTokenForDisplay(token: VCToken) {
    return {
      id: token.id,
      type: token.metadata.type,
      description: token.metadata.description,
      status: token.status,
      issuer: token.issuerDid,
      subject: token.subjectDid,
      currentOwner: token.currentOwnerDid,
      createdAt: new Date(token.tokenState.createdAt),
      isFinalized: token.status === 'finalized',
      transferCount: token.tokenState.transferHistory.length
    };
  }
}

export const vcTokenService = new VCTokenService();