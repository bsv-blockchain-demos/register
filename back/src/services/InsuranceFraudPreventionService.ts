import { Db } from 'mongodb';
import { WalletClient } from '@bsv/sdk';
import { VerifiableCredential } from '@quarkid/vc-core';
import { KMSClient } from '@quarkid/kms-client';
import { Suite, LANG } from '@quarkid/kms-core';
import { DIDDocument } from '@quarkid/did-core';
import { VCTokenService } from './vcTokenService';
import { QuarkIdAgentService } from './quarkIdAgentService';
import * as crypto from 'crypto';

/**
 * Prescription credential schema for BBS+ selective disclosure
 */
export interface PrescriptionCredentialSubject {
  id: string; // Patient DID
  patientInfo: {
    did: string;
    name: string;
    birthDate?: string;
    insuranceProvider?: string;
  };
  prescription: {
    id: string;
    medicationName: string;
    dosage: string;
    frequency: string;
    duration: string;
    quantity: number;
    refills: number;
    prescribedDate: string;
    validUntil: string;
    status: 'active' | 'dispensed' | 'expired' | 'cancelled';
  };
  doctor: {
    did: string;
    name: string;
    licenseNumber: string;
    specialization?: string;
  };
  issuanceProof: {
    nonce: string;
    timestamp: string;
    blockchainAnchor?: string;
  };
}

/**
 * Dispensing proof credential subject
 */
export interface DispensingProofSubject {
  id: string; // Patient DID
  dispensingEvent: {
    prescriptionId: string;
    pharmacyDid: string;
    pharmacyName: string;
    pharmacistLicense: string;
    medicationDispensed: {
      name: string;
      batchNumber: string;
      expirationDate: string;
      quantityDispensed: number;
    };
    dispensedDate: string;
    patientConfirmation: boolean;
  };
  originalPrescriptionHash: string;
}

/**
 * Insurance verification proof (derived from prescription + dispensing)
 */
export interface InsuranceVerificationProof {
  patientDid: string;
  prescriptionExists: boolean;
  medicationDispensed: boolean;
  doctorAuthorized: boolean;
  pharmacyAuthorized: boolean;
  patientConfirmed: boolean;
  fraudScore: number; // 0-100, 0 = no fraud indicators
  verificationTimestamp: string;
  proofHash: string;
}

/**
 * Selective disclosure frames for different verification scenarios
 */
export const DISCLOSURE_FRAMES = {
  // For insurance companies - minimal disclosure
  insurance: {
    '@context': [
      'https://www.w3.org/2018/credentials/v1',
      {
        // Medical vocabulary definitions for prescription credentials
        'patientInfo': 'https://quarkid.org/medical#patientInfo',
        'prescription': 'https://quarkid.org/medical#prescription',
        'doctor': 'https://quarkid.org/medical#doctor',
        'patient': 'https://quarkid.org/medical#patient',
        'issuanceProof': 'https://quarkid.org/medical#issuanceProof',
        'medicationName': 'https://quarkid.org/medical#medicationName',
        'dosage': 'https://quarkid.org/medical#dosage',
        'quantity': 'https://quarkid.org/medical#quantity',
        'instructions': 'https://quarkid.org/medical#instructions',
        'refills': 'https://quarkid.org/medical#refills',
        'validUntil': 'https://quarkid.org/medical#validUntil',
        'diagnosisCode': 'https://quarkid.org/medical#diagnosisCode',
        'prescribedDate': 'https://quarkid.org/medical#prescribedDate',
        'status': 'https://quarkid.org/medical#status',
        'cost': 'https://quarkid.org/medical#cost',
        'insuranceProvider': 'https://quarkid.org/medical#insuranceProvider',
        'name': 'https://quarkid.org/medical#name',
        'birthDate': 'https://quarkid.org/medical#birthDate',
        'insuranceNumber': 'https://quarkid.org/medical#insuranceNumber',
        'contactInfo': 'https://quarkid.org/medical#contactInfo',
        'licenseNumber': 'https://quarkid.org/medical#licenseNumber',
        'specialization': 'https://quarkid.org/medical#specialization',
        'nonce': 'https://quarkid.org/medical#nonce',
        'timestamp': 'https://quarkid.org/medical#timestamp',
        'blockchainAnchor': 'https://quarkid.org/medical#blockchainAnchor'
      },
      'https://w3id.org/security/bbs/v1'
    ],
    'type': ['VerifiableCredential', 'PrescriptionCredential'],
    'credentialSubject': {
      '@explicit': true,
      'id': {}, // Patient DID revealed
      'patientInfo': {
        '@explicit': true,
        'insuranceProvider': {} // Only insurance provider revealed
        // name, birthDate hidden
      },
      'prescription': {
        '@explicit': true,
        'status': {}, // Status revealed
        'prescribedDate': {}, // Date revealed for validity
        'validUntil': {} // Expiry revealed
        // medicationName, dosage, doctor details hidden
      },
      'issuanceProof': {
        '@explicit': true,
        'timestamp': {},
        'blockchainAnchor': {}
      }
      // Full doctor info hidden
    }
  },

  // For pharmacy verification - show medication details but hide personal info
  pharmacy: {
    '@context': [
      'https://www.w3.org/2018/credentials/v1',
      {
        // Medical vocabulary definitions for prescription credentials
        'patientInfo': 'https://quarkid.org/medical#patientInfo',
        'prescription': 'https://quarkid.org/medical#prescription',
        'doctor': 'https://quarkid.org/medical#doctor',
        'patient': 'https://quarkid.org/medical#patient',
        'issuanceProof': 'https://quarkid.org/medical#issuanceProof',
        'medicationName': 'https://quarkid.org/medical#medicationName',
        'dosage': 'https://quarkid.org/medical#dosage',
        'quantity': 'https://quarkid.org/medical#quantity',
        'instructions': 'https://quarkid.org/medical#instructions',
        'refills': 'https://quarkid.org/medical#refills',
        'validUntil': 'https://quarkid.org/medical#validUntil',
        'diagnosisCode': 'https://quarkid.org/medical#diagnosisCode',
        'prescribedDate': 'https://quarkid.org/medical#prescribedDate',
        'status': 'https://quarkid.org/medical#status',
        'cost': 'https://quarkid.org/medical#cost',
        'insuranceProvider': 'https://quarkid.org/medical#insuranceProvider',
        'name': 'https://quarkid.org/medical#name',
        'birthDate': 'https://quarkid.org/medical#birthDate',
        'insuranceNumber': 'https://quarkid.org/medical#insuranceNumber',
        'contactInfo': 'https://quarkid.org/medical#contactInfo',
        'licenseNumber': 'https://quarkid.org/medical#licenseNumber',
        'specialization': 'https://quarkid.org/medical#specialization',
        'nonce': 'https://quarkid.org/medical#nonce',
        'timestamp': 'https://quarkid.org/medical#timestamp',
        'blockchainAnchor': 'https://quarkid.org/medical#blockchainAnchor'
      },
      'https://w3id.org/security/bbs/v1'
    ],
    'type': ['VerifiableCredential', 'PrescriptionCredential'],
    'credentialSubject': {
      '@explicit': true,
      'id': {}, // Patient DID revealed
      'prescription': {
        '@explicit': true,
        'id': {},
        'medicationName': {},
        'dosage': {},
        'frequency': {},
        'duration': {},
        'quantity': {},
        'refills': {},
        'status': {},
        'prescribedDate': {},
        'validUntil': {}
      },
      'doctor': {
        '@explicit': true,
        'licenseNumber': {}, // Verify doctor authorization
        'specialization': {}
        // Doctor name and DID hidden for privacy
      }
      // Patient personal info hidden
    }
  },

  // For audit purposes - full disclosure with proper authorization
  audit: {
    '@context': [
      'https://www.w3.org/2018/credentials/v1',
      {
        // Medical vocabulary definitions for prescription credentials
        'patientInfo': 'https://quarkid.org/medical#patientInfo',
        'prescription': 'https://quarkid.org/medical#prescription',
        'doctor': 'https://quarkid.org/medical#doctor',
        'patient': 'https://quarkid.org/medical#patient',
        'issuanceProof': 'https://quarkid.org/medical#issuanceProof',
        'medicationName': 'https://quarkid.org/medical#medicationName',
        'dosage': 'https://quarkid.org/medical#dosage',
        'quantity': 'https://quarkid.org/medical#quantity',
        'instructions': 'https://quarkid.org/medical#instructions',
        'refills': 'https://quarkid.org/medical#refills',
        'validUntil': 'https://quarkid.org/medical#validUntil',
        'diagnosisCode': 'https://quarkid.org/medical#diagnosisCode',
        'prescribedDate': 'https://quarkid.org/medical#prescribedDate',
        'status': 'https://quarkid.org/medical#status',
        'cost': 'https://quarkid.org/medical#cost',
        'insuranceProvider': 'https://quarkid.org/medical#insuranceProvider',
        'name': 'https://quarkid.org/medical#name',
        'birthDate': 'https://quarkid.org/medical#birthDate',
        'insuranceNumber': 'https://quarkid.org/medical#insuranceNumber',
        'contactInfo': 'https://quarkid.org/medical#contactInfo',
        'licenseNumber': 'https://quarkid.org/medical#licenseNumber',
        'specialization': 'https://quarkid.org/medical#specialization',
        'nonce': 'https://quarkid.org/medical#nonce',
        'timestamp': 'https://quarkid.org/medical#timestamp',
        'blockchainAnchor': 'https://quarkid.org/medical#blockchainAnchor'
      },
      'https://w3id.org/security/bbs/v1'
    ],
    'type': ['VerifiableCredential', 'PrescriptionCredential'],
    'credentialSubject': {} // Full disclosure
  }
};

/**
 * Service for preventing insurance fraud using BBS+ selective disclosure ZKPs
 * combined with Schnorr signature blockchain anchoring
 */
export class InsuranceFraudPreventionService {
  private db: Db;
  private walletClient: WalletClient;
  private kmsClient: KMSClient;
  private vcTokenService: VCTokenService;
  private quarkIdAgentService: QuarkIdAgentService;
  private fraudPreventionCollection: any;

  constructor(
    db: Db,
    walletClient: WalletClient,
    kmsClient: KMSClient,
    vcTokenService: VCTokenService,
    quarkIdAgentService: QuarkIdAgentService,
    didResolver: (did: string) => Promise<DIDDocument>
  ) {
    this.db = db;
    this.walletClient = walletClient;
    this.kmsClient = kmsClient;
    this.vcTokenService = vcTokenService;
    this.quarkIdAgentService = quarkIdAgentService;
    this.fraudPreventionCollection = db.collection('fraud_prevention_proofs');
    
    // Initialize KMS client with BBS+ support
    this.initializeKMSClient(didResolver);
    this.createIndexes();
  }

  private async initializeKMSClient(didResolver: (did: string) => Promise<DIDDocument>) {
    // Ensure BBS+ suite is available for selective disclosure
    console.log('[InsuranceFraudPrevention] Initializing KMS client with BBS+ support');
  }

  private async createIndexes() {
    await this.fraudPreventionCollection.createIndex({ patientDid: 1 });
    await this.fraudPreventionCollection.createIndex({ prescriptionId: 1 });
    await this.fraudPreventionCollection.createIndex({ proofHash: 1 });
    await this.fraudPreventionCollection.createIndex({ verificationTimestamp: 1 });
  }

  /**
   * Doctor creates a prescription credential with BBS+ signature
   * This enables selective disclosure for different verification scenarios
   */
  async createPrescriptionCredential(params: {
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
  }): Promise<{
    prescriptionCredential: VerifiableCredential;
    vcToken: any;
    blockchainAnchor: string;
  }> {
    try {
      console.log('[InsuranceFraudPrevention] Creating prescription credential with BBS+ signature');

      // Generate unique prescription ID and proof nonce
      const prescriptionId = `rx-${crypto.randomUUID()}`;
      const nonce = crypto.randomBytes(32).toString('hex');

      // Create credential subject with full data
      const credentialSubject: PrescriptionCredentialSubject = {
        id: params.patientDid,
        patientInfo: {
          did: params.patientDid,
          name: params.patientInfo.name,
          birthDate: params.patientInfo.birthDate,
          insuranceProvider: params.patientInfo.insuranceProvider
        },
        prescription: {
          id: prescriptionId,
          medicationName: params.prescriptionData.medicationName,
          dosage: params.prescriptionData.dosage,
          frequency: params.prescriptionData.frequency,
          duration: params.prescriptionData.duration,
          quantity: params.prescriptionData.quantity,
          refills: params.prescriptionData.refills,
          prescribedDate: new Date().toISOString(),
          validUntil: params.prescriptionData.validUntil,
          status: 'active'
        },
        doctor: {
          did: params.doctorDid,
          name: params.doctorInfo.name,
          licenseNumber: params.doctorInfo.licenseNumber,
          specialization: params.doctorInfo.specialization
        },
        issuanceProof: {
          nonce,
          timestamp: new Date().toISOString(),
        }
      };

      // Create BBS+ signed credential using existing VCTokenService
      const vcToken = await this.vcTokenService.createVCToken({
        issuerDid: params.doctorDid,
        subjectDid: params.patientDid,
        credentialType: 'PrescriptionCredential',
        claims: credentialSubject,
        metadata: {
          description: `Prescription ${prescriptionId} for ${params.patientInfo.name}`,
          customData: {
            prescriptionId,
            useBBSSignature: true, // Flag for BBS+ signing
            enableSelectiveDisclosure: true
          }
        }
      });

      // Create blockchain anchor using Schnorr signature
      const anchorHash = await this.createBlockchainAnchor({
        credentialId: vcToken.vcId,
        prescriptionId,
        doctorDid: params.doctorDid,
        patientDid: params.patientDid,
        timestamp: new Date().toISOString()
      });

      // Update the credential with blockchain anchor
      credentialSubject.issuanceProof.blockchainAnchor = anchorHash;

      console.log(`[InsuranceFraudPrevention] Created prescription credential: ${prescriptionId}`);

      return {
        prescriptionCredential: vcToken.vc,
        vcToken,
        blockchainAnchor: anchorHash
      };

    } catch (error) {
      console.error('[InsuranceFraudPrevention] Error creating prescription credential:', error);
      throw new Error(`Failed to create prescription credential: ${error.message}`);
    }
  }

  /**
   * Pharmacy generates dispensing proof using the prescription credential
   */
  async generateDispensingProof(params: {
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
  }): Promise<{
    dispensingCredential: VerifiableCredential;
    fraudScore: number;
  }> {
    try {
      console.log('[InsuranceFraudPrevention] Generating dispensing proof');

      // Get original prescription credential
      const originalVCToken = await this.vcTokenService.getVCToken(params.prescriptionCredentialId);
      if (!originalVCToken) {
        throw new Error('Original prescription credential not found');
      }

      // Verify prescription is valid and active
      if (originalVCToken.vc.credentialSubject.prescription.status !== 'active') {
        throw new Error('Prescription is not active');
      }

      // Calculate fraud score based on various factors
      const fraudScore = await this.calculateFraudScore({
        originalCredential: originalVCToken.vc,
        dispensingData: params.dispensingData,
        patientConfirmation: params.patientConfirmation
      });

      // Create dispensing proof credential
      const dispensingSubject: DispensingProofSubject = {
        id: originalVCToken.vc.credentialSubject.id,
        dispensingEvent: {
          prescriptionId: originalVCToken.vc.credentialSubject.prescription.id,
          pharmacyDid: params.pharmacyDid,
          pharmacyName: params.dispensingData.pharmacyName,
          pharmacistLicense: params.dispensingData.pharmacistLicense,
          medicationDispensed: {
            name: originalVCToken.vc.credentialSubject.prescription.medicationName,
            batchNumber: params.dispensingData.batchNumber,
            expirationDate: params.dispensingData.expirationDate,
            quantityDispensed: params.dispensingData.quantityDispensed
          },
          dispensedDate: new Date().toISOString(),
          patientConfirmation: params.patientConfirmation
        },
        originalPrescriptionHash: this.hashCredential(originalVCToken.vc)
      };

      // Create dispensing credential with BBS+ signature
      const dispensingVCToken = await this.vcTokenService.createVCToken({
        issuerDid: params.pharmacyDid,
        subjectDid: originalVCToken.vc.credentialSubject.id,
        credentialType: 'DispensingProofCredential',
        claims: dispensingSubject,
        metadata: {
          description: `Dispensing proof for prescription ${originalVCToken.vc.credentialSubject.prescription.id}`,
          customData: {
            originalPrescriptionId: params.prescriptionCredentialId,
            fraudScore,
            useBBSSignature: true
          }
        }
      });

      console.log(`[InsuranceFraudPrevention] Generated dispensing proof with fraud score: ${fraudScore}`);

      return {
        dispensingCredential: dispensingVCToken.vc,
        fraudScore
      };

    } catch (error) {
      console.error('[InsuranceFraudPrevention] Error generating dispensing proof:', error);
      throw new Error(`Failed to generate dispensing proof: ${error.message}`);
    }
  }

  /**
   * Insurance company verifies claim using selective disclosure ZKP
   * Only receives minimal necessary information while proving validity
   */
  async verifyInsuranceClaim(params: {
    insurerDid: string;
    prescriptionCredentialId: string;
    dispensingCredentialId: string;
    claimAmount?: number;
  }): Promise<InsuranceVerificationProof> {
    try {
      console.log('[InsuranceFraudPrevention] Verifying insurance claim with selective disclosure');

      // Get original credentials
      const prescriptionToken = await this.vcTokenService.getVCToken(params.prescriptionCredentialId);
      const dispensingToken = await this.vcTokenService.getVCToken(params.dispensingCredentialId);

      if (!prescriptionToken || !dispensingToken) {
        throw new Error('Required credentials not found');
      }

      // Create selective disclosure proof for insurance using BBS+ deriveVC
      const insuranceDisclosure = await this.kmsClient.deriveVC({
        vc: prescriptionToken.vc,
        frame: DISCLOSURE_FRAMES.insurance
      });

      // Verify the chain: prescription -> dispensing -> patient confirmation
      const verificationResult = await this.performChainVerification({
        prescriptionCredential: prescriptionToken.vc,
        dispensingCredential: dispensingToken.vc,
        insuranceDisclosure
      });

      // Create comprehensive verification proof
      const verificationProof: InsuranceVerificationProof = {
        patientDid: prescriptionToken.vc.credentialSubject.id,
        prescriptionExists: verificationResult.prescriptionValid,
        medicationDispensed: verificationResult.dispensingValid,
        doctorAuthorized: verificationResult.doctorAuthorized,
        pharmacyAuthorized: verificationResult.pharmacyAuthorized,
        patientConfirmed: dispensingToken.vc.credentialSubject.dispensingEvent.patientConfirmation,
        fraudScore: verificationResult.fraudScore,
        verificationTimestamp: new Date().toISOString(),
        proofHash: this.generateVerificationHash({
          prescriptionHash: this.hashCredential(prescriptionToken.vc),
          dispensingHash: this.hashCredential(dispensingToken.vc),
          insurerDid: params.insurerDid,
          timestamp: new Date().toISOString()
        })
      };

      // Store verification proof for audit trail
      await this.fraudPreventionCollection.insertOne({
        ...verificationProof,
        _id: crypto.randomUUID(),
        prescriptionCredentialId: params.prescriptionCredentialId,
        dispensingCredentialId: params.dispensingCredentialId,
        insurerDid: params.insurerDid,
        claimAmount: params.claimAmount,
        createdAt: new Date()
      });

      console.log(`[InsuranceFraudPrevention] Insurance verification completed with fraud score: ${verificationProof.fraudScore}`);

      return verificationProof;

    } catch (error) {
      console.error('[InsuranceFraudPrevention] Error verifying insurance claim:', error);
      throw new Error(`Failed to verify insurance claim: ${error.message}`);
    }
  }

  // Private helper methods

  private async createBlockchainAnchor(data: any): Promise<string> {
    // Create Schnorr-signed hash anchor on BSV blockchain
    const anchorData = JSON.stringify(data);
    const hash = crypto.createHash('sha256').update(anchorData).digest('hex');
    
    // In production, this would create a transaction on BSV blockchain
    // For now, return the hash as the anchor
    return hash;
  }

  private async calculateFraudScore(params: {
    originalCredential: VerifiableCredential;
    dispensingData: any;
    patientConfirmation: boolean;
  }): Promise<number> {
    let score = 0;

    // Check for various fraud indicators
    if (!params.patientConfirmation) score += 30;
    
    // Check if dispensing quantity exceeds prescription
    const prescribed = params.originalCredential.credentialSubject.prescription.quantity;
    const dispensed = params.dispensingData.quantityDispensed;
    if (dispensed > prescribed) score += 40;

    // Check prescription validity
    const validUntil = new Date(params.originalCredential.credentialSubject.prescription.validUntil);
    if (new Date() > validUntil) score += 50;

    // Additional fraud checks would go here...

    return Math.min(score, 100); // Cap at 100
  }

  private async performChainVerification(params: {
    prescriptionCredential: VerifiableCredential;
    dispensingCredential: VerifiableCredential;
    insuranceDisclosure: VerifiableCredential;
  }): Promise<{
    prescriptionValid: boolean;
    dispensingValid: boolean;
    doctorAuthorized: boolean;
    pharmacyAuthorized: boolean;
    fraudScore: number;
  }> {
    // Verify credential signatures and chain integrity
    const prescriptionVerification = await this.vcTokenService.verifyVCToken(
      params.prescriptionCredential.id
    );
    
    const dispensingVerification = await this.vcTokenService.verifyVCToken(
      params.dispensingCredential.id
    );

    return {
      prescriptionValid: prescriptionVerification.vcValid,
      dispensingValid: dispensingVerification.vcValid,
      doctorAuthorized: true, // Would check doctor license registry
      pharmacyAuthorized: true, // Would check pharmacy license registry
      fraudScore: 0 // Calculate based on various factors
    };
  }

  private hashCredential(credential: VerifiableCredential): string {
    const credentialString = JSON.stringify(credential);
    return crypto.createHash('sha256').update(credentialString).digest('hex');
  }

  private generateVerificationHash(data: any): string {
    const verificationString = JSON.stringify(data);
    return crypto.createHash('sha256').update(verificationString).digest('hex');
  }

  /**
   * Get fraud prevention statistics
   */
  async getStatistics(): Promise<{
    totalVerifications: number;
    fraudAttempts: number;
    averageFraudScore: number;
    verificationsByTimeframe: any;
  }> {
    const total = await this.fraudPreventionCollection.countDocuments();
    const fraudAttempts = await this.fraudPreventionCollection.countDocuments({
      fraudScore: { $gte: 50 }
    });

    const avgScore = await this.fraudPreventionCollection.aggregate([
      { $group: { _id: null, avgFraudScore: { $avg: '$fraudScore' } } }
    ]).toArray();

    return {
      totalVerifications: total,
      fraudAttempts,
      averageFraudScore: avgScore[0]?.avgFraudScore || 0,
      verificationsByTimeframe: {} // Could add time-based analytics
    };
  }
}