/**
 * API Service for QuarkID Prescription Management System
 * Handles all HTTP requests to the backend API
 */

import type { ActorType } from "@/types";

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  details?: string;
}

class ApiService {
  private baseUrl: string;
  private defaultHeaders: HeadersInit;

  constructor() {
    this.baseUrl = API_BASE_URL;
    this.defaultHeaders = {
      'Content-Type': 'application/json',
    };
  }

  /**
   * Generic HTTP request method
   */
  private async request<T = any>(
    method: string,
    endpoint: string,
    data?: any,
    headers?: HeadersInit
  ): Promise<ApiResponse<T>> {
    try {
      const url = `${this.baseUrl}${endpoint}`;
      const config: RequestInit = {
        method,
        headers: {
          ...this.defaultHeaders,
          ...headers,
        },
      };

      if (data && (method === 'POST' || method === 'PUT')) {
        config.body = JSON.stringify(data);
      }

      console.log(`[ApiService] ${method} ${url}`, data);

      const response = await fetch(url, config);
      
      // Check if response has content
      const contentType = response.headers.get('content-type');
      const hasJson = contentType && contentType.includes('application/json');
      
      let result: any = null;
      
      if (hasJson) {
        try {
          result = await response.json();
        } catch (jsonError) {
          console.error(`[ApiService] Failed to parse JSON response:`, jsonError);
          throw new Error('Invalid JSON response from server');
        }
      }

      if (!response.ok) {
        throw new Error(result?.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      // If no result was parsed, create a default success response
      if (!result) {
        result = { success: true };
      }

      return result;
    } catch (error) {
      console.error(`[ApiService] Error in ${method} ${endpoint}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error occurred'
      };
    }
  }

  // VC Token API (New Unified System)

  /**
   * Create a VC Token using the new unified system
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
    validFrom?: string;
    validUntil?: string;
  }): Promise<ApiResponse> {
    return this.request('POST', '/v1/vc-tokens/create', params);
  }

  /**
   * Create a prescription using the new unified system (simplified)
   */
  async createVCTokenPrescription(params: {
    doctorDid: string;
    patientDid: string;
    medicationName: string;
    dosage: string;
    quantity: number;
    instructions: string;
    diagnosisCode?: string;
    insuranceDid?: string;
    expiryDays?: number;
  }): Promise<ApiResponse> {
    return this.request('POST', '/v1/vc-tokens/prescription/create', params);
  }

  /**
   * Transfer a VC Token to new owner
   */
  async transferVCToken(params: {
    tokenId: string;
    fromDid: string;
    toDid: string;
    metadata?: any;
  }): Promise<ApiResponse> {
    return this.request('POST', '/v1/vc-tokens/transfer', params);
  }

  /**
   * Finalize a VC Token (mark as completed)
   */
  async finalizeVCToken(params: {
    tokenId: string;
    finalizerDid: string;
    metadata?: any;
  }): Promise<ApiResponse> {
    return this.request('POST', '/v1/vc-tokens/finalize', params);
  }

  /**
   * Get a specific VC Token
   */
  async getVCToken(tokenId: string): Promise<ApiResponse> {
    return this.request('GET', `/v1/vc-tokens/${tokenId}`);
  }

  /**
   * List VC Tokens with filters
   */
  async listVCTokens(filter?: {
    issuerDid?: string;
    subjectDid?: string;
    currentOwnerDid?: string;
    type?: string;
    status?: string;
  }): Promise<ApiResponse> {
    const params = new URLSearchParams();
    if (filter) {
      Object.entries(filter).forEach(([key, value]) => {
        if (value) params.append(key, value);
      });
    }
    return this.request('GET', `/v1/vc-tokens/list?${params}`);
  }

  /**
   * Verify a VC Token
   */
  async verifyVCToken(tokenId: string): Promise<ApiResponse> {
    return this.request('POST', `/v1/vc-tokens/verify/${tokenId}`);
  }

  /**
   * Get VC Token statistics
   */
  async getVCTokenStats(): Promise<ApiResponse> {
    return this.request('GET', '/v1/vc-tokens/stats/summary');
  }

  // Actor Management API

  /**
   * Create a new actor (patient, doctor, pharmacy, insurance)
   */
  async createActor(actorData: {
    name: string;
    type: ActorType 
    email?: string;
    phone?: string;
    address?: string;
    licenseNumber?: string;
    specialization?: string;
    insuranceProvider?: string;
    identityKey?: string;
  }): Promise<ApiResponse> {
    return this.request('POST', '/v1/actors', actorData);
  }

  /**
   * Get all actors with optional filtering
   */
  async getActors(filters?: {
    type?: string;
    active?: boolean;
  }): Promise<ApiResponse> {
    const params = new URLSearchParams();
    if (filters?.type) params.append('type', filters.type);
    if (filters?.active !== undefined) params.append('active', filters.active.toString());
    
    const queryString = params.toString();
    const endpoint = queryString ? `/v1/actors?${queryString}` : '/v1/actors';
    
    return this.request('GET', endpoint);
  }

  /**
   * Get specific actor by ID
   */
  async getActor(id: string): Promise<ApiResponse> {
    return this.request('GET', `/v1/actors/${id}`);
  }

  /**
   * Get actor by DID
   */
  async getActorByDid(did: string): Promise<ApiResponse> {
    return this.request('GET', `/v1/actors/did/${encodeURIComponent(did)}`);
  }

  /**
   * Update actor information
   */
  async updateActor(id: string, updateData: any): Promise<ApiResponse> {
    return this.request('PUT', `/v1/actors/${id}`, updateData);
  }

  /**
   * Delete an actor by ID
   */
  async deleteActor(id: string): Promise<ApiResponse> {
    return this.request('DELETE', `/v1/actors/${id}`);
  }

  /**
   * Get actor statistics
   */
  async getActorStats(): Promise<ApiResponse> {
    return this.request('GET', '/v1/actors/stats/summary');
  }

  // Prescription Workflow API

  /**
   * Create a new prescription
   */
  async createPrescription(requestData: {
    doctorDid: string;
    patientDid: string;
    prescriptionData: {
      patientName: string;
      patientId: string;
      patientAge: number;
      insuranceProvider?: string;
      diagnosis: string;
      medicationName: string;
      dosage: string;
      frequency: string;
      duration: string;
    };
  }): Promise<ApiResponse> {
    return this.request('POST', '/v1/prescriptions', requestData);
  }

  /**
   * Get prescription by ID
   */
  async getPrescription(id: string): Promise<ApiResponse> {
    return this.request('GET', `/v1/prescriptions/${id}`);
  }

  /**
   * Get all prescriptions
   */
  async getPrescriptions(): Promise<ApiResponse> {
    return this.request('GET', '/v1/prescriptions');
  }

  /**
   * Dispense a prescription
   */
  async dispensePrescription(prescriptionId: string, pharmacyDid: string): Promise<ApiResponse> {
    return this.request('POST', `/v1/prescriptions/${prescriptionId}/dispense`, {
      pharmacyDid,
      dispensedAt: new Date().toISOString()
    });
  }

  /**
   * Create dispensation record
   */
  async createDispensation(prescriptionId: string, dispensationData: {
    pharmacyDid: string;
    medicationProvided: string;
    batchNumber?: string;
    expiryDate?: string;
    pharmacistNotes?: string;
  }): Promise<ApiResponse> {
    return this.request('POST', `/v1/prescriptions/${prescriptionId}/dispensations`, dispensationData);
  }

  /**
   * Create confirmation record
   */
  async createConfirmation(prescriptionId: string, confirmationData: {
    patientDid: string;
    confirmed: boolean;
    patientNotes?: string;
  }): Promise<ApiResponse> {
    return this.request('POST', `/v1/prescriptions/${prescriptionId}/confirm`, confirmationData);
  }

  /**
   * Get prescriptions by actor DID
   */
  async getPrescriptionsByActor(actorDid: string, role: 'patient' | 'doctor' | 'pharmacy'): Promise<ApiResponse> {
    return this.request('GET', `/v1/prescriptions/actor/${encodeURIComponent(actorDid)}?role=${role}`);
  }

  /**
   * Get prescriptions by status
   */
  async getPrescriptionsByStatus(status: 'pending' | 'dispensed' | 'confirmed'): Promise<ApiResponse> {
    return this.request('GET', `/v1/prescriptions/status/${status}`);
  }

  /**
   * Share a prescription with a pharmacy
   */
  async sharePrescription(shareData: {
    prescriptionId: string;
    patientDid: string;
    pharmacyDid: string;
  }): Promise<ApiResponse> {
    return this.request('POST', '/v1/enhanced/prescriptions/share', shareData);
  }

  /**
   * Get prescriptions shared with a pharmacy
   */
  async getSharedPrescriptions(pharmacyDid: string): Promise<ApiResponse> {
    return this.request('GET', `/v1/prescriptions/shared/${encodeURIComponent(pharmacyDid)}`);
  }

  /**
   * Get prescriptions by insurance provider name
   */
  async getPrescriptionsByInsuranceProvider(insuranceProvider: string): Promise<ApiResponse> {
    return this.request('GET', `/v1/prescriptions/insurance/${encodeURIComponent(insuranceProvider)}`);
  }

  // Token Management API

  /**
   * Create a new BSV token for prescription
   */
  async createToken(tokenData: {
    prescriptionId: string;
    ownerDid: string;
    tokenType: 'prescription';
    metadata?: any;
  }): Promise<ApiResponse> {
    return this.request('POST', '/v1/tokens', tokenData);
  }

  /**
   * Get token by transaction ID
   */
  async getToken(txid: string): Promise<ApiResponse> {
    return this.request('GET', `/v1/tokens/${txid}`);
  }

  /**
   * Get token status
   */
  async getTokenStatus(txid: string): Promise<ApiResponse> {
    return this.request('GET', `/v1/tokens/${txid}/status`);
  }

  /**
   * Transfer token ownership
   */
  async transferToken(txid: string, transferData: {
    fromDid: string;
    toDid: string;
    transferType: 'dispense' | 'confirm';
  }): Promise<ApiResponse> {
    return this.request('PUT', `/v1/tokens/${txid}/transfer`, transferData);
  }

  /**
   * Finalize token as dispensed
   */
  async finalizeToken(txid: string, finalizeData: {
    actorDid: string;
    finalStatus: 'dispensed';
  }): Promise<ApiResponse> {
    return this.request('PUT', `/v1/tokens/${txid}/finalize`, finalizeData);
  }

  /**
   * Get tokens by prescription ID
   */
  async getTokensByPrescription(prescriptionId: string): Promise<ApiResponse> {
    return this.request('GET', `/v1/tokens/prescription/${prescriptionId}`);
  }

  /**
   * Get tokens by actor DID
   */
  async getTokensByActor(actorDid: string): Promise<ApiResponse> {
    return this.request('GET', `/v1/tokens/actor/${encodeURIComponent(actorDid)}`);
  }

  /**
   * Get token statistics
   */
  async getTokenStats(): Promise<ApiResponse> {
    return this.request('GET', '/v1/tokens/stats');
  }

  // Enhanced BSV Token Prescription API

  /**
   * Create enhanced prescription with BSV token and VCs
   */
  async createEnhancedPrescription(prescriptionData: {
    patientDid: string;
    doctorDid: string;
    medicationName: string;
    dosage: string;
    quantity: string;
    instructions: string;
    diagnosisCode?: string;
    insuranceDid?: string;
    expiryHours?: string;
  }): Promise<ApiResponse> {
    return this.request('POST', '/v1/enhanced/prescriptions', prescriptionData);
  }

  /**
   * Get enhanced prescription token by ID
   */
  async getEnhancedPrescription(tokenId: string): Promise<ApiResponse> {
    return this.request('GET', `/v1/enhanced/prescriptions/${tokenId}`);
  }

  /**
   * Get enhanced prescriptions by patient DID
   */
  async getEnhancedPrescriptionsByPatient(patientDid: string): Promise<ApiResponse> {
    return this.request('GET', `/v1/enhanced/prescriptions/patient/${encodeURIComponent(patientDid)}`);
  }

  /**
   * Get enhanced prescriptions by doctor DID
   */
  async getEnhancedPrescriptionsByDoctor(doctorDid: string): Promise<ApiResponse> {
    return this.request('GET', `/v1/enhanced/prescriptions/doctor/${encodeURIComponent(doctorDid)}`);
  }

  /**
   * Get enhanced prescriptions by pharmacy DID
   */
  async getEnhancedPrescriptionsByPharmacy(pharmacyDid: string): Promise<ApiResponse> {
    return this.request('GET', `/v1/enhanced/prescriptions/pharmacy/${encodeURIComponent(pharmacyDid)}`);
  }

  /**
   * Get enhanced prescriptions by insurance DID
   */
  async getEnhancedPrescriptionsByInsurance(insuranceDid: string): Promise<ApiResponse> {
    return this.request('GET', `/v1/enhanced/prescriptions/insurance/${encodeURIComponent(insuranceDid)}`);
  }

  /**
   * Dispense enhanced prescription with BSV token update
   */
  async dispenseEnhancedPrescription(tokenId: string, dispensationData: {
    pharmacyDid: string;
    batchNumber: string;
    manufacturerInfo: string;
    dispensedQuantity: string;
    pharmacistSignature: string;
  }): Promise<ApiResponse> {
    return this.request('POST', `/v1/enhanced/prescriptions/${tokenId}/dispense`, dispensationData);
  }

  /**
   * Confirm enhanced prescription receipt with BSV token finalization
   */
  async confirmEnhancedPrescription(tokenId: string, confirmationData: {
    patientSignature: string;
  }): Promise<ApiResponse> {
    return this.request('POST', `/v1/enhanced/prescriptions/${tokenId}/confirm`, confirmationData);
  }

  /**
   * Get enhanced prescriptions by status
   */
  async getEnhancedPrescriptionsByStatus(status: 'created' | 'dispensing' | 'dispensed' | 'confirmed' | 'expired'): Promise<ApiResponse> {
    return this.request('GET', `/v1/enhanced/prescriptions/status/${status}`);
  }

  // DWN Messaging API

  /**
   * Send encrypted VC via DWN
   */
  async sendDWNMessage(messageData: {
    from: string;
    to: string;
    subject: string;
    vcData: any;
    type: 'prescription' | 'dispensation' | 'confirmation';
    prescriptionId?: string;
    threadId?: string;
    urgent?: boolean;
  }): Promise<ApiResponse> {
    return this.request('POST', '/v1/dwn/send', messageData);
  }

  /**
   * Get DWN messages for a DID
   */
  async getDWNMessages(filters: {
    did: string;
    type?: string;
    threadId?: string;
    unreadOnly?: boolean;
    limit?: number;
  }): Promise<ApiResponse> {
    const params = new URLSearchParams();
    params.append('did', filters.did);
    if (filters.type) params.append('type', filters.type);
    if (filters.threadId) params.append('threadId', filters.threadId);
    if (filters.unreadOnly) params.append('unreadOnly', filters.unreadOnly.toString());
    if (filters.limit) params.append('limit', filters.limit.toString());

    return this.request('GET', `/v1/dwn/messages?${params.toString()}`);
  }

  /**
   * Get specific DWN message and decrypt
   */
  async getDWNMessage(messageId: string, recipientDid: string): Promise<ApiResponse> {
    return this.request('GET', `/v1/dwn/messages/${messageId}?recipientDid=${encodeURIComponent(recipientDid)}`);
  }

  /**
   * Mark DWN message as read
   */
  async markDWNMessageRead(messageId: string, recipientDid: string): Promise<ApiResponse> {
    return this.request('PUT', `/v1/dwn/messages/${messageId}/read`, { recipientDid });
  }

  /**
   * Get DWN thread messages
   */
  async getDWNThread(threadId: string, participantDid: string): Promise<ApiResponse> {
    return this.request('GET', `/v1/dwn/threads/${threadId}?participantDid=${encodeURIComponent(participantDid)}`);
  }

  /**
   * Get DWN messaging statistics
   */
  async getDWNStats(did: string): Promise<ApiResponse> {
    return this.request('GET', `/v1/dwn/stats/${encodeURIComponent(did)}`);
  }

  // QR Code Operations

  /**
   * Decrypt QR code data using backend
   */
  async decryptQRCode(data: {
    actorId: string;
    qrData: unknown;
  }): Promise<ApiResponse> {
    return this.request('POST', '/v1/qr/decrypt', data);
  }

  // DID Management API

  /**
   * Create a new DID
   */
  async createDid(didData: {
    topic?: string;
    document?: any;
  }): Promise<ApiResponse> {
    return this.request('POST', '/v1/dids', didData);
  }

  /**
   * Get DID document
   */
  async getDid(did: string): Promise<ApiResponse> {
    return this.request('GET', `/v1/dids/${encodeURIComponent(did)}`);
  }

  /**
   * Update DID document
   */
  async updateDid(did: string, updateData: {
    document: any;
    signature?: string;
  }): Promise<ApiResponse> {
    return this.request('PUT', `/v1/dids/${encodeURIComponent(did)}`, updateData);
  }

  // Fraud Prevention API

  /**
   * Create fraud prevention prescription with BBS+ signature
   */
  async createFraudPreventionPrescription(params: {
    doctorDid: string;
    patientDid: string;
    prescriptionData: {
      medicationName: string;
      dosage: string;
      frequency: string;
      duration: string;
      quantity: number;
      refills: number;
      validUntil: string;
    };
    patientInfo: {
      name: string;
      birthDate?: string;
      insuranceProvider?: string;
    };
    doctorInfo: {
      name: string;
      licenseNumber: string;
      specialization?: string;
    };
  }): Promise<ApiResponse> {
    return this.request('POST', '/v1/fraud-prevention/prescription/create', params);
  }

  /**
   * Verify prescription for pharmacy using selective disclosure
   */
  async verifyFraudPreventionPrescription(params: {
    pharmacyDid: string;
    prescriptionCredentialId: string;
  }): Promise<ApiResponse> {
    return this.request('POST', '/v1/fraud-prevention/prescription/verify', params);
  }

  /**
   * Create dispensing proof with fraud scoring
   */
  async createDispensingProof(params: {
    pharmacyDid: string;
    prescriptionCredentialId: string;
    dispensingData: {
      batchNumber: string;
      expirationDate: string;
      quantityDispensed: number;
      pharmacyName: string;
      pharmacistLicense: string;
    };
    patientConfirmation: boolean;
  }): Promise<ApiResponse> {
    return this.request('POST', '/v1/fraud-prevention/dispensing/create', params);
  }

  /**
   * Verify insurance claim using selective disclosure ZKP
   */
  async verifyInsuranceClaim(params: {
    insurerDid: string;
    prescriptionCredentialId: string;
    dispensingCredentialId: string;
    claimAmount?: number;
  }): Promise<ApiResponse> {
    return this.request('POST', '/v1/fraud-prevention/insurance/verify', params);
  }

  /**
   * Get selective disclosure for different actor types
   */
  async getSelectiveDisclosure(params: {
    prescriptionId: string;
    actorType: 'insurance' | 'pharmacy' | 'audit';
    requestorDid: string;
  }): Promise<ApiResponse> {
    const { prescriptionId, actorType, requestorDid } = params;
    return this.request('GET', `/v1/fraud-prevention/prescription/${prescriptionId}/disclosure?actorType=${actorType}&requestorDid=${encodeURIComponent(requestorDid)}`);
  }

  /**
   * Request full audit disclosure
   */
  async requestAuditFullDisclosure(params: {
    auditorDid: string;
    prescriptionCredentialId: string;
    auditReason: string;
    authorizationToken: string;
  }): Promise<ApiResponse> {
    return this.request('POST', '/v1/fraud-prevention/audit/full-disclosure', params);
  }

  /**
   * Get fraud prevention statistics
   */
  async getFraudPreventionStats(): Promise<ApiResponse> {
    return this.request('GET', '/v1/fraud-prevention/statistics');
  }

  /**
   * Run complete fraud prevention workflow demonstration
   */
  async runFraudPreventionDemo(params: {
    demoScenario: 'normal' | 'fraud';
  }): Promise<ApiResponse> {
    return this.request('POST', '/v1/fraud-prevention/demo/complete-workflow', params);
  }

  // Health Check

  /**
   * Check API health
   */
  async healthCheck(): Promise<ApiResponse> {
    return this.request('GET', '/health');
  }
}

// Export singleton instance
export const apiService = new ApiService();
export default apiService;