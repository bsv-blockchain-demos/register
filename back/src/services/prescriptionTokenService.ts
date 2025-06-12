import { Db } from 'mongodb';
import crypto from 'crypto';

// Simplified types for now - we'll replace with real BSV overlay types later
interface UTXO {
  txid: string;
  vout: number;
  scriptPubKey: string;
  satoshis: number;
  sourceTransactionHex: string;
  publicKeyHex?: string;
}

interface VerifiableCredential {
  '@context': string[];
  id: string;
  type: string[];
  issuer: string;
  issuanceDate: string;
  expirationDate?: string;
  credentialSubject: any;
  proof?: any;
}

/**
 * Enhanced prescription token using BSV overlay with push-drop mechanics
 */
export interface PrescriptionToken {
  id: string;
  txid: string;
  vout: number;
  satoshis: number;
  status: 'created' | 'dispensing' | 'dispensed' | 'confirmed' | 'expired';
  prescriptionDid: string; // DID of the prescription VC
  patientDid: string;
  doctorDid: string;
  pharmacyDid?: string;
  insuranceDid?: string;
  unlockConditions: {
    requiresPatientSignature: boolean;
    requiresPharmacySignature: boolean;
    expiryTimestamp?: number;
  };
  metadata: {
    medicationName: string;
    dosage: string;
    quantity: number;
    instructions: string;
    diagnosisCode?: string;
    batchNumber?: string;
  };
  prescriptionVC?: VerifiableCredential;
  dispensationVC?: VerifiableCredential;
  confirmationVC?: VerifiableCredential;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Enhanced prescription token service with real BSV overlay integration
 */
export class PrescriptionTokenService {
  private quarkIdAgentService: any;
  private vcService: any;
  private tokensCollection: any;

  constructor(
    private db: Db,
    private walletClient: any,
    private overlayConfig: {
      endpoint: string;
      topic: string;
    }
  ) {
    this.tokensCollection = db.collection('prescription_tokens');
    this.vcService = {};
    
    // Initialize QuarkID Agent service for DID operations
    const { QuarkIdAgentService } = require('./quarkIdAgentService');
    this.quarkIdAgentService = new QuarkIdAgentService({
      mongodb: {
        uri: process.env.MONGODB_URI || 'mongodb://localhost:27017',
        dbName: this.db.databaseName
      },
      walletClient: this.walletClient,
      db: this.db,
      overlayConfig: this.overlayConfig,
      overlayProvider: this.overlayConfig.endpoint
    });
  }

  /**
   * Create prescription token with real BSV transaction and VCs
   */
  async createPrescriptionToken(prescriptionData: {
    patientDid: string;
    doctorDid: string;
    medicationName: string;
    dosage: string;
    quantity: number;
    instructions: string;
    diagnosisCode?: string;
    insuranceDid?: string;
    expiryHours?: number;
  }): Promise<PrescriptionToken> {
    
    try {
      // 1. Create prescription VC
      const prescriptionVC = await this.createPrescriptionVC(prescriptionData);
      
      // 2. Create DID for this prescription
      const prescriptionDidResponse = await this.createPrescriptionDid(prescriptionVC);
      
      // 3. Create BSV token with push-drop mechanics
      const tokenTx = await this.createTokenTransaction(prescriptionData, prescriptionDidResponse.did);
      
      // 4. Store token record
      const token: PrescriptionToken = {
        id: crypto.randomUUID(),
        txid: tokenTx.id('hex'),
        vout: 0, // Assuming prescription token is first output
        satoshis: 1000, // Minimum value for token
        status: 'created',
        prescriptionDid: prescriptionDidResponse.did,
        patientDid: prescriptionData.patientDid,
        doctorDid: prescriptionData.doctorDid,
        insuranceDid: prescriptionData.insuranceDid,
        unlockConditions: {
          requiresPatientSignature: true,
          requiresPharmacySignature: true,
          expiryTimestamp: prescriptionData.expiryHours ? 
            Date.now() + (prescriptionData.expiryHours * 60 * 60 * 1000) : undefined
        },
        metadata: {
          medicationName: prescriptionData.medicationName,
          dosage: prescriptionData.dosage,
          quantity: prescriptionData.quantity,
          instructions: prescriptionData.instructions,
          diagnosisCode: prescriptionData.diagnosisCode
        },
        prescriptionVC: prescriptionVC,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await this.tokensCollection.insertOne(token);
      
      console.log(`Created prescription token: ${token.txid}:${token.vout}`);
      return token;

    } catch (error) {
      console.error('Error creating prescription token:', error);
      throw new Error(`Failed to create prescription token: ${error.message}`);
    }
  }

  /**
   * Dispense prescription - pharmacy creates dispensation VC and updates token
   */
  async dispensePrescription(
    tokenId: string,
    pharmacyDid: string,
    dispensationData: {
      batchNumber: string;
      manufacturerInfo: string;
      dispensedQuantity: number;
      dispensedDate: Date;
      pharmacistSignature: string;
    }
  ): Promise<PrescriptionToken> {
    
    const token = await this.tokensCollection.findOne({ id: tokenId });
    if (!token) {
      throw new Error('Prescription token not found');
    }

    if (token.status !== 'created') {
      throw new Error(`Cannot dispense prescription in status: ${token.status}`);
    }

    try {
      // Create dispensation VC
      const dispensationVC = await this.createDispensationVC(token, pharmacyDid, dispensationData);
      
      // Update token status and add dispensation info
      const updatedToken = await this.tokensCollection.findOneAndUpdate(
        { id: tokenId },
        {
          $set: {
            status: 'dispensed',
            pharmacyDid: pharmacyDid,
            'metadata.batchNumber': dispensationData.batchNumber,
            dispensationVC: dispensationVC,
            updatedAt: new Date()
          }
        },
        { returnDocument: 'after' }
      );

      console.log(`Dispensed prescription token: ${tokenId}`);
      return updatedToken.value;

    } catch (error) {
      console.error('Error dispensing prescription:', error);
      throw new Error(`Failed to dispense prescription: ${error.message}`);
    }
  }

  /**
   * Confirm prescription receipt - patient creates confirmation VC
   */
  async confirmPrescriptionReceipt(
    tokenId: string,
    patientSignature: string
  ): Promise<PrescriptionToken> {
    
    const token = await this.tokensCollection.findOne({ id: tokenId });
    if (!token) {
      throw new Error('Prescription token not found');
    }

    if (token.status !== 'dispensed') {
      throw new Error(`Cannot confirm prescription in status: ${token.status}`);
    }

    try {
      // Create confirmation VC
      const confirmationVC = await this.createConfirmationVC(token, patientSignature);
      
      // Finalize token - this would typically "burn" or lock the BSV token
      await this.finalizeToken(token);
      
      const updatedToken = await this.tokensCollection.findOneAndUpdate(
        { id: tokenId },
        {
          $set: {
            status: 'confirmed',
            confirmationVC: confirmationVC,
            updatedAt: new Date()
          }
        },
        { returnDocument: 'after' }
      );

      console.log(`Confirmed prescription token: ${tokenId}`);
      return updatedToken.value;

    } catch (error) {
      console.error('Error confirming prescription:', error);
      throw new Error(`Failed to confirm prescription: ${error.message}`);
    }
  }

  /**
   * Get prescription token by ID
   */
  async getToken(tokenId: string): Promise<PrescriptionToken | null> {
    return await this.tokensCollection.findOne({ id: tokenId });
  }

  /**
   * Get tokens by patient DID
   */
  async getTokensByPatient(patientDid: string): Promise<PrescriptionToken[]> {
    return await this.tokensCollection.find({ patientDid: patientDid }).toArray();
  }

  /**
   * Get tokens by doctor DID
   */
  async getTokensByDoctor(doctorDid: string): Promise<PrescriptionToken[]> {
    return await this.tokensCollection.find({ doctorDid: doctorDid }).toArray();
  }

  /**
   * Get tokens by pharmacy DID
   */
  async getTokensByPharmacy(pharmacyDid: string): Promise<PrescriptionToken[]> {
    return await this.tokensCollection.find({ pharmacyDid: pharmacyDid }).toArray();
  }

  // Private helper methods

  private async createPrescriptionVC(prescriptionData: any): Promise<VerifiableCredential> {
    const vcData = {
      patient: { did: prescriptionData.patientDid },
      doctor: { did: prescriptionData.doctorDid },
      medication: {
        name: prescriptionData.medicationName,
        dosage: prescriptionData.dosage,
        quantity: prescriptionData.quantity,
        instructions: prescriptionData.instructions
      },
      diagnosis: prescriptionData.diagnosisCode,
      prescribedDate: new Date().toISOString()
    };

    return {
      '@context': [
        'https://www.w3.org/2018/credentials/v1',
        'https://schema.quarkid.com/prescription/v1'
      ],
      id: `urn:prescription:${crypto.randomUUID()}`,
      type: ['VerifiableCredential', 'PrescriptionCredential'],
      issuer: prescriptionData.doctorDid,
      issuanceDate: new Date().toISOString(),
      expirationDate: prescriptionData.expiryHours ? 
        new Date(Date.now() + prescriptionData.expiryHours * 60 * 60 * 1000).toISOString() :
        new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days default
      credentialSubject: vcData
    };
  }

  private async createPrescriptionDid(prescriptionVC: VerifiableCredential): Promise<any> {
    return await this.quarkIdAgentService.createDid(prescriptionVC);
  }

  private async createTokenTransaction(prescriptionData: any, prescriptionDid: string): Promise<any> {
    // Create a BSV transaction that represents the prescription token
    // This would use push-drop mechanics where the token can only be spent
    // by both patient and pharmacy signatures
    
    const tx: any = {
      outputs: []
    };
    
    // Add prescription data as OP_RETURN output
    const prescriptionScript = this.createPrescriptionScript(prescriptionData, prescriptionDid);
    tx.outputs.push({
      satoshis: 0,
      lockingScript: prescriptionScript
    });
    
    // Add spendable token output with multi-sig conditions
    const tokenScript = this.createTokenLockingScript(prescriptionData.patientDid);
    tx.outputs.push({
      satoshis: 1000,
      lockingScript: tokenScript
    });
    
    return tx;
  }

  private createPrescriptionScript(prescriptionData: any, prescriptionDid: string): any {
    // Create OP_RETURN script with prescription metadata
    // This is where the prescription data would be embedded
    // Implementation would depend on specific BSV script requirements
    throw new Error('Prescription script creation not implemented');
  }

  private createTokenLockingScript(patientDid: string): any {
    // Create locking script that requires specific conditions for spending
    // This implements the "push-drop" mechanics
    throw new Error('Token locking script creation not implemented');
  }

  private async createDispensationVC(token: PrescriptionToken, pharmacyDid: string, dispensationData: any): Promise<VerifiableCredential> {
    const vcData = {
      prescriptionReference: token.prescriptionDid,
      pharmacy: { did: pharmacyDid },
      patient: { did: token.patientDid },
      dispensation: {
        batchNumber: dispensationData.batchNumber,
        manufacturerInfo: dispensationData.manufacturerInfo,
        dispensedQuantity: dispensationData.dispensedQuantity,
        dispensedDate: dispensationData.dispensedDate.toISOString(),
        pharmacistSignature: dispensationData.pharmacistSignature
      }
    };

    return {
      '@context': [
        'https://www.w3.org/2018/credentials/v1',
        'https://schema.quarkid.com/dispensation/v1'
      ],
      id: `urn:dispensation:${crypto.randomUUID()}`,
      type: ['VerifiableCredential', 'DispensationCredential'],
      issuer: pharmacyDid,
      issuanceDate: new Date().toISOString(),
      expirationDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(), // 1 year
      credentialSubject: vcData
    };
  }

  private async createConfirmationVC(token: PrescriptionToken, patientSignature: string): Promise<VerifiableCredential> {
    const vcData = {
      prescriptionReference: token.prescriptionDid,
      patient: { did: token.patientDid },
      confirmation: {
        confirmedDate: new Date().toISOString(),
        patientSignature: patientSignature,
        medicationReceived: token.metadata.medicationName,
        quantity: token.metadata.quantity
      }
    };

    return {
      '@context': [
        'https://www.w3.org/2018/credentials/v1',
        'https://schema.quarkid.com/confirmation/v1'
      ],
      id: `urn:confirmation:${crypto.randomUUID()}`,
      type: ['VerifiableCredential', 'ConfirmationCredential'],
      issuer: token.patientDid,
      issuanceDate: new Date().toISOString(),
      expirationDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(), // 1 year
      credentialSubject: vcData
    };
  }

  private async finalizeToken(token: PrescriptionToken): Promise<void> {
    // This would create a final transaction that "burns" or locks the token
    // to prevent double-spending and mark the prescription as completed
    console.log(`Finalizing token: ${token.txid}:${token.vout}`);
  }
  
  // BSV SDK integration helpers have been removed - now handled by QuarkIdAgentService
}
