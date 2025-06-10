// src/types.ts

// ==== DID Types ====
export interface CreateDidPayload {
  operation: 'CREATE_DID';
  controllerPublicKeyHex: string;
  didDocument?: {
    '@context'?: string | string[];
    [key: string]: unknown;
  };
}

export interface BackendSubmitPayload {
  transaction: string; // Raw transaction hex
  payload: CreateDidPayload;
}

export interface DidResolutionResult {
  didDocument: Record<string, unknown> | null;
  didDocumentMetadata: Record<string, unknown>;
  didResolutionMetadata: Record<string, unknown>;
}

export interface CreateDidResponse {
  outputsAccepted: Array<{
    txid: string;
    vout: number;
    script: string;
    satoshis: number;
    topic: string;
  }>;
  topic: string;
  txid: string;
  did: string;
}

// ==== Actor Types ====
export type ActorType = 'patient' | 'doctor' | 'pharmacy' | 'insurance';

export interface Actor {
  id: string;
  type: ActorType;
  name: string;
  did?: string;
  publicKey?: string;
  privateKey?: string; // Stored locally only
  qrCode?: string;
  createdAt: Date;
  // Doctor-specific properties
  licenseNumber?: string;
  specialization?: string;
}

// ==== Verifiable Credential Types ====
export interface VerifiableCredential {
  '@context': string[];
  id: string;
  type: string[];
  issuer: string; // DID of issuer
  issuanceDate: string;
  credentialSubject: Record<string, unknown>;
  proof?: Record<string, unknown>;
}

// Prescription VC
export interface PrescriptionCredential extends VerifiableCredential {
  credentialSubject: {
    id: string; // Patient DID
    patientInfo: {
      name: string;
      identificationNumber: string;
      age: number;
      insuranceProvider: string;
    };
    prescription: {
      id: string; // Prescription hash
      diagnosis: string;
      medication: {
        name: string;
        dosage: string;
        frequency: string;
        duration: string;
      };
      doctorId: string; // Doctor DID
      prescribedDate: string;
      status: 'no dispensado' | 'dispensado';
    };
  };
}

// Dispensation VC
export interface DispensationCredential extends VerifiableCredential {
  credentialSubject: {
    id: string; // Patient DID
    prescription: {
      id: string; // Reference to prescription hash
      medication: {
        name: string;
        batchNumber: string;
        expirationDate: string;
        manufacturer: string;
      };
      dispensedDate: string;
      pharmacyId: string; // Pharmacy DID
      pharmacistId: string;
    };
  };
}

// Confirmation VC
export interface ConfirmationCredential extends VerifiableCredential {
  credentialSubject: {
    id: string; // Patient DID
    confirmation: {
      prescriptionId: string; // Reference to prescription hash
      confirmedDate: string;
      status: 'confirmed' | 'rejected';
      notes?: string;
    };
  };
}

// ==== BSV Transaction Types ====
export interface BSVToken {
  txid: string;
  vout: number;
  satoshis: number;
  script: string;
  status: 'no dispensado' | 'dispensado';
  unlockableBy: string; // DID that can unlock this token
  metadata?: {
    prescriptionId?: string;
    medicationInfo?: string;
    batchNumber?: string;
  };
}

// ==== UI State Types ====
export interface AppState {
  currentActor: Actor | null;
  actors: Actor[];
  prescriptions: PrescriptionCredential[];
  dispensations: DispensationCredential[];
  confirmations: ConfirmationCredential[];
  tokens: BSVToken[];
}

// ==== QR Code Types ====
export interface QRCodeData {
  type: 'actor_did' | 'prescription_vc' | 'token_transfer';
  data: {
    did?: string;
    vcData?: Record<string, unknown>;
    tokenData?: BSVToken;
    encryptedWith?: string; // Public key used for encryption
  };
  timestamp: string;
}

// ==== API Response Types ====
export interface ApiResponse<T = Record<string, unknown>> {
  status: 'success' | 'error';
  data?: T;
  description?: string;
  txid?: string;
  did?: string;
}

// ==== DWN (Decentralized Web Node) Types ====
export interface DWNMessage {
  id: string;
  type: 'vc_transfer' | 'token_transfer';
  from: string; // Sender DID
  to: string; // Recipient DID
  encryptedData: string;
  txData?: string; // BSV transaction hex
  timestamp: string;
}

// ==== Prescription Workflow Types ====
export interface PrescriptionFlow {
  id: string;
  patientDid: string;
  doctorDid: string;
  pharmacyDid?: string;
  insuranceDid: string;
  currentStage: 'created' | 'sent_to_patient' | 'sent_to_pharmacy' | 'dispensed' | 'confirmed';
  prescriptionVC?: PrescriptionCredential;
  dispensationVC?: DispensationCredential;
  confirmationVC?: ConfirmationCredential;
  tokens: BSVToken[];
  createdAt: Date;
  updatedAt: Date;
}

// ==== Encryption/Decryption Types ====
export interface EncryptedData extends Record<string, unknown> {
  encryptedContent: string;
  encryptedKey: string;
  iv: string;
  algorithm: string;
}

// ==== Form Types ====
export interface PrescriptionFormData {
  patientName: string;
  patientId: string;
  patientAge: number;
  insuranceProvider: string;
  diagnosis: string;
  medicationName: string;
  dosage: string;
  frequency: string;
  duration: string;
}

export interface DispensationFormData {
  batchNumber: string;
  expirationDate: string;
  manufacturer: string;
  pharmacistId: string;
  notes?: string;
}

export interface ConfirmationFormData {
  status: 'confirmed' | 'rejected';
  notes?: string;
}
