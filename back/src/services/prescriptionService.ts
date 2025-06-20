import { PrivateKey, PublicKey, Transaction, ARC, P2PKH } from '@bsv/sdk';
import { WalletClient } from '@bsv/sdk';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import { Hash } from '@bsv/sdk';

// Import QuarkID Agent components (would be actual imports in production)
import { Agent } from '@quarkid/agent';
import { DWNClient } from '@quarkid/dwn-client';
import { VC } from '@quarkid/agent/dist/vc/vc';
import { QuarkIdAgentService } from './quarkIdAgentService';

/**
 * Prescription-related types and interfaces
 */
export interface PrescriptionVC {
  '@context': string[];
  id: string;
  type: string[];
  issuer: string; // Doctor's DID
  issuanceDate: string;
  credentialSubject: {
    id: string; // Patient's DID
    patientInfo: {
      name: string;
      identificationNumber: string;
      age: number;
      insuranceProvider?: string;
    };
    prescription: {
      id: string;
      diagnosis: string;
      medication: {
        name: string;
        dosage: string;
        frequency: string;
        duration: string;
      };
      doctorId: string;
      prescribedDate: string;
      status: 'no dispensado' | 'dispensado';
    };
  };
  proof?: any;
}

export interface DispensationVC {
  '@context': string[];
  id: string;
  type: string[];
  issuer: string; // Pharmacy's DID
  issuanceDate: string;
  credentialSubject: {
    id: string; // Patient's DID
    prescription: {
      id: string;
      medication: {
        name: string;
        dosage: string;
        batchNumber: string;
        expirationDate: string;
        manufacturer: string;
      };
      dispensedDate: string;
      pharmacyId: string;
      pharmacistId: string;
    };
  };
  proof?: any;
}

export interface ConfirmationVC {
  '@context': string[];
  id: string;
  type: string[];
  issuer: string; // Patient's DID
  issuanceDate: string;
  credentialSubject: {
    id: string; // Patient's DID
    confirmation: {
      prescriptionId: string;
      confirmedDate: string;
      status: 'confirmed';
      notes?: string;
    };
  };
  proof?: any;
}

export interface BSVPrescriptionToken {
  txid: string;
  vout: number;
  satoshis: number;
  script: string;
  status: 'no dispensado' | 'dispensado';
  unlockableBy: string; // DID
  metadata: {
    prescriptionId: string;
    medicationInfo: string;
    batchNumber?: string;
  };
}

/**
 * Service for managing the complete prescription workflow
 * Handles VC creation, BSV token management, and DWN messaging
 */
export class PrescriptionService {
  private walletClient: WalletClient;
  private quarkIdAgentService: QuarkIdAgentService; // QuarkID Agent instance
  // private dwnClient: DWNClient; // DWN client for encrypted messaging

  constructor(
    walletClient: WalletClient,
    quarkIdAgentService: QuarkIdAgentService
    // dwnClient: DWNClient
  ) {
    this.walletClient = walletClient;
    this.quarkIdAgentService = quarkIdAgentService;
    // this.dwnClient = dwnClient;
  }

  /**
   * Step 1: Doctor creates prescription VC and BSV token
   */
  async createPrescription(
    doctorDid: string,
    patientDid: string,
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
    }
  ): Promise<{
    prescriptionVC: PrescriptionVC;
    token: BSVPrescriptionToken;
    encryptedMessage: string;
  }> {
    try {
      console.log('[PrescriptionService] Creating prescription for patient:', patientDid);

      const prescriptionId = uuidv4();
      
      // Prepare the credential claims
      const credentialClaims = {
        patientInfo: {
          name: prescriptionData.patientName,
          identificationNumber: prescriptionData.patientId,
          age: prescriptionData.patientAge,
          insuranceProvider: prescriptionData.insuranceProvider
        },
        prescription: {
          id: prescriptionId,
          diagnosis: prescriptionData.diagnosis,
          medication: {
            name: prescriptionData.medicationName,
            dosage: prescriptionData.dosage,
            frequency: prescriptionData.frequency,
            duration: prescriptionData.duration
          },
          doctorId: doctorDid,
          prescribedDate: new Date().toISOString(),
          status: 'no dispensado'
        }
      };

      // Use QuarkID agent to issue and sign the VC
      const signedVC = await this.quarkIdAgentService.issueVC(
        doctorDid,           // issuerDid
        patientDid,          // subjectDid
        'PrescriptionCredential',  // credentialType
        credentialClaims     // claims
      );

      // Convert VerifiableCredential to PrescriptionVC format
      const prescriptionVC: PrescriptionVC = {
        '@context': signedVC['@context'] || [],
        id: signedVC.id,
        type: signedVC.type,
        issuer: typeof signedVC.issuer === 'string' 
          ? signedVC.issuer 
          : signedVC.issuer.id,
        issuanceDate: signedVC.issuanceDate instanceof Date 
          ? signedVC.issuanceDate.toISOString() 
          : signedVC.issuanceDate,
        credentialSubject: signedVC.credentialSubject,
        proof: signedVC.proof
      };

      // Create BSV token with "no dispensado" status
      const token = await this.createPrescriptionToken(
        prescriptionId,
        patientDid,
        `${prescriptionData.medicationName} - ${prescriptionData.dosage}`
      );

      // Encrypt VC for DWN transmission
      const encryptedMessage = await this.encryptVCForPatient(prescriptionVC, patientDid);

      console.log('[PrescriptionService] Prescription created successfully:', prescriptionId);
      
      return {
        prescriptionVC,
        token,
        encryptedMessage
      };
    } catch (error) {
      console.error('[PrescriptionService] Error creating prescription:', error);
      throw new Error(`Failed to create prescription: ${error.message}`);
    }
  }

  /**
   * Step 2: Pharmacy creates dispensation VC and updates token
   */
  async createDispensation(
    pharmacyDid: string,
    pharmacistDid: string,
    prescriptionId: string,
    dispensationData: {
      batchNumber: string;
      expirationDate: string;
      manufacturer: string;
    },
    pharmacyPrivateKey: string
  ): Promise<{
    dispensationVC: DispensationVC;
    updatedToken: BSVPrescriptionToken;
    encryptedMessage: string;
  }> {
    try {
      console.log('[PrescriptionService] Creating dispensation for prescription:', prescriptionId);

      // Verify prescription exists and is valid
      const prescriptionVC = await this.getPrescriptionVC(prescriptionId);
      if (!prescriptionVC) {
        throw new Error('Prescription not found');
      }

      if (prescriptionVC.credentialSubject.prescription.status === 'dispensado') {
        throw new Error('Prescription already dispensed');
      }

      // Create Dispensation VC
      const dispensationVC: DispensationVC = {
        '@context': [
          'https://www.w3.org/2018/credentials/v1',
          'https://schema.org/',
          'https://quarkid.org/medical/v1'
        ],
        id: uuidv4(),
        type: ['VerifiableCredential', 'DispensationCredential'],
        issuer: pharmacyDid,
        issuanceDate: new Date().toISOString(),
        credentialSubject: {
          id: prescriptionVC.credentialSubject.id, // Patient's DID
          prescription: {
            id: prescriptionId,
            medication: {
              name: prescriptionVC.credentialSubject.prescription.medication.name,
              dosage: prescriptionVC.credentialSubject.prescription.medication.dosage,
              batchNumber: dispensationData.batchNumber,
              expirationDate: dispensationData.expirationDate,
              manufacturer: dispensationData.manufacturer
            },
            dispensedDate: new Date().toISOString(),
            pharmacyId: pharmacyDid,
            pharmacistId: pharmacistDid
          }
        }
      };

      // Add digital signature to VC
      dispensationVC.proof = await this.signVC(dispensationVC, pharmacyPrivateKey);

      // Transfer token to pharmacy but keep status as "no dispensado"
      const updatedToken = await this.transferTokenToPharmacy(
        prescriptionId,
        pharmacyDid,
        dispensationData.batchNumber
      );

      // Encrypt VC for patient
      const encryptedMessage = await this.encryptVCForPatient(
        dispensationVC,
        prescriptionVC.credentialSubject.id
      );

      console.log('[PrescriptionService] Dispensation created successfully:', prescriptionId);
      
      return {
        dispensationVC,
        updatedToken,
        encryptedMessage
      };
    } catch (error) {
      console.error('[PrescriptionService] Error creating dispensation:', error);
      throw new Error(`Failed to create dispensation: ${error.message}`);
    }
  }

  /**
   * Step 3: Patient creates confirmation VC and finalizes token status
   */
  async createConfirmation(
    patientDid: string,
    prescriptionId: string,
    confirmationData: {
      notes?: string;
    },
    patientPrivateKey: string
  ): Promise<{
    confirmationVC: ConfirmationVC;
    finalizedToken: BSVPrescriptionToken;
  }> {
    try {
      console.log('[PrescriptionService] Creating confirmation for prescription:', prescriptionId);

      // Verify dispensation exists
      const dispensationVC = await this.getDispensationVC(prescriptionId);
      if (!dispensationVC) {
        throw new Error('Dispensation not found - cannot confirm without dispensation');
      }

      // Create Confirmation VC
      const confirmationVC: ConfirmationVC = {
        '@context': [
          'https://www.w3.org/2018/credentials/v1',
          'https://schema.org/',
          'https://quarkid.org/medical/v1'
        ],
        id: uuidv4(),
        type: ['VerifiableCredential', 'ConfirmationCredential'],
        issuer: patientDid,
        issuanceDate: new Date().toISOString(),
        credentialSubject: {
          id: patientDid,
          confirmation: {
            prescriptionId,
            confirmedDate: new Date().toISOString(),
            status: 'confirmed',
            notes: confirmationData.notes
          }
        }
      };

      // Add digital signature to VC
      confirmationVC.proof = await this.signVC(confirmationVC, patientPrivateKey);

      // Finalize token status to "dispensado"
      const finalizedToken = await this.finalizeTokenStatus(prescriptionId);

      console.log('[PrescriptionService] Confirmation created successfully:', prescriptionId);
      
      return {
        confirmationVC,
        finalizedToken
      };
    } catch (error) {
      console.error('[PrescriptionService] Error creating confirmation:', error);
      throw new Error(`Failed to create confirmation: ${error.message}`);
    }
  }

  /**
   * Generate unique prescription ID
   */
  private generatePrescriptionId(patientDid: string, doctorDid: string, medication: string): string {
    const data = `${patientDid}-${doctorDid}-${Date.now()}-${medication}`;
    return crypto.createHash('sha256').update(data).digest('hex').substring(0, 16);
  }

  /**
   * Sign a Verifiable Credential
   */
  private async signVC(vc: any, privateKeyHex: string): Promise<any> {
    try {
      const privateKey = PrivateKey.fromString(privateKeyHex, 'hex');
      const vcString = JSON.stringify({
        ...vc,
        proof: undefined
      });
      
      const messageBuffer = Buffer.from(vcString, 'utf8');
      const hashBuffer = crypto.createHash('sha256').update(messageBuffer).digest();
      const signature = privateKey.sign(Array.from(hashBuffer));
      
      return {
        type: 'EcdsaSecp256k1Signature2019',
        created: new Date().toISOString(),
        verificationMethod: `${vc.issuer}#key-1`,
        proofPurpose: 'assertionMethod',
        jws: signature.toString('base64')
      };
    } catch (error) {
      console.error('[PrescriptionService] Error signing VC:', error);
      throw error;
    }
  }

  /**
   * Create BSV token for prescription
   */
  private async createPrescriptionToken(
    prescriptionId: string,
    patientDid: string,
    medicationInfo: string
  ): Promise<BSVPrescriptionToken> {
    try {
      // In production, this would create an actual BSV transaction
      // For demo purposes, we simulate token creation
      const mockTxId = crypto.randomBytes(32).toString('hex');
      
      const token: BSVPrescriptionToken = {
        txid: mockTxId,
        vout: 1,
        satoshis: 1000,
        script: this.generateP2PKHScript(patientDid),
        status: 'no dispensado',
        unlockableBy: patientDid,
        metadata: {
          prescriptionId,
          medicationInfo,
        }
      };

      // Store token information (in production, this would be on-chain)
      await this.storeTokenInfo(token);

      return token;
    } catch (error) {
      console.error('[PrescriptionService] Error creating token:', error);
      throw error;
    }
  }

  /**
   * Transfer token to pharmacy
   */
  private async transferTokenToPharmacy(
    prescriptionId: string,
    pharmacyDid: string,
    batchNumber: string
  ): Promise<BSVPrescriptionToken> {
    try {
      const token = await this.getTokenByPrescriptionId(prescriptionId);
      if (!token) {
        throw new Error('Token not found');
      }

      const updatedToken: BSVPrescriptionToken = {
        ...token,
        unlockableBy: pharmacyDid,
        metadata: {
          ...token.metadata,
          batchNumber
        }
      };

      await this.storeTokenInfo(updatedToken);
      return updatedToken;
    } catch (error) {
      console.error('[PrescriptionService] Error transferring token:', error);
      throw error;
    }
  }

  /**
   * Finalize token status to "dispensado"
   */
  private async finalizeTokenStatus(prescriptionId: string): Promise<BSVPrescriptionToken> {
    try {
      const token = await this.getTokenByPrescriptionId(prescriptionId);
      if (!token) {
        throw new Error('Token not found');
      }

      const finalizedToken: BSVPrescriptionToken = {
        ...token,
        status: 'dispensado'
      };

      await this.storeTokenInfo(finalizedToken);
      return finalizedToken;
    } catch (error) {
      console.error('[PrescriptionService] Error finalizing token:', error);
      throw error;
    }
  }

  /**
   * Encrypt VC for patient transmission via DWN
   */
  private async encryptVCForPatient(vc: any, patientDid: string): Promise<string> {
    try {
      // In production, this would use the patient's public key from their DID document
      // For demo purposes, we'll return a mock encrypted message
      const vcString = JSON.stringify(vc);
      const encryptedData = Buffer.from(vcString).toString('base64');
      
      return `encrypted:${patientDid}:${encryptedData}`;
    } catch (error) {
      console.error('[PrescriptionService] Error encrypting VC:', error);
      throw error;
    }
  }

  /**
   * Helper methods for data retrieval (in production, these would query the database/blockchain)
   */
  private async getPrescriptionVC(prescriptionId: string): Promise<PrescriptionVC | null> {
    // Mock implementation - in production, query from database or blockchain
    return null;
  }

  private async getDispensationVC(prescriptionId: string): Promise<DispensationVC | null> {
    // Mock implementation - in production, query from database or blockchain
    return null;
  }

  private async getTokenByPrescriptionId(prescriptionId: string): Promise<BSVPrescriptionToken | null> {
    // Mock implementation - in production, query from database or blockchain
    return null;
  }

  private generateP2PKHScript(did: string): string {
    // Simplified P2PKH script generation
    const didHash = crypto.createHash('sha256').update(did).digest('hex').substring(0, 40);
    return `76a914${didHash}88ac`;
  }

  private async storeTokenInfo(token: BSVPrescriptionToken): Promise<void> {
    // Mock implementation - in production, store in database
    console.log('[PrescriptionService] Storing token:', token.txid);
  }
}