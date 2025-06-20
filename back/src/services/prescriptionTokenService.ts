import { Db } from 'mongodb';
import crypto from 'crypto';
import { Script, OP, Hash, Utils, PushDrop, WalletProtocol, Byte } from '@bsv/sdk';

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
  status: 'created' | 'dispensing' | 'dispensed' | 'confirmed' | 'expired';
  prescriptionVC: VerifiableCredential;
  patientDid: string;
  doctorDid: string;
  pharmacyDid: string | null;
  dispensationVC?: VerifiableCredential;
  confirmationVC?: VerifiableCredential;
  createdAt: Date;
  updatedAt: Date;
  tokenState: {
    owner: string;
    canDispense: boolean;
    dispensedAt: Date | null;
    confirmedAt: Date | null;
  };
}

/**
 * Enhanced prescription token service with real BSV overlay integration
 */
export class PrescriptionTokenService {
  private db: Db;
  private walletClient: any;
  private overlayConfig: any;
  private quarkIdAgentService: any;
  private vcService: any;
  private tokensCollection: any;

  constructor(
    db: Db, 
    walletClient: any, 
    overlayConfig: any,
    quarkIdAgentService: any
  ) {
    this.db = db;
    this.walletClient = walletClient;
    this.overlayConfig = overlayConfig;
    this.quarkIdAgentService = quarkIdAgentService;
    
    // Initialize VC service (placeholder for now)
    this.vcService = {};
    this.tokensCollection = db.collection('prescription_tokens');
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
      
      // 2. Create BSV token with push-drop mechanics
      // The token references the prescription VC and is locked to patient/pharmacy signatures
      const tokenTx = await this.createTokenTransaction(prescriptionData, prescriptionVC.id);
      
      // 3. Store token record
      const token: PrescriptionToken = {
        id: crypto.randomUUID(),
        txid: tokenTx.txid,
        prescriptionVC,
        status: 'created',
        patientDid: prescriptionData.patientDid,
        doctorDid: prescriptionData.doctorDid,
        pharmacyDid: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        tokenState: {
          owner: prescriptionData.patientDid,
          canDispense: true,
          dispensedAt: null,
          confirmedAt: null
        }
      };
      
      // Store in database
      await this.db.collection('prescription_tokens').insertOne(token);
      
      // Broadcast transaction (in production)
      // await this.broadcastTransaction(tokenTx);
      
      return token;
      
    } catch (error) {
      console.error('[PrescriptionTokenService] Error creating prescription token:', error);
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
            'tokenState.dispensedAt': new Date(),
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
            'tokenState.confirmedAt': new Date(),
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
      medicationName: prescriptionData.medicationName,
      dosage: prescriptionData.dosage,
      quantity: prescriptionData.quantity,
      instructions: prescriptionData.instructions,
      diagnosisCode: prescriptionData.diagnosisCode,
      patientDid: prescriptionData.patientDid,
      doctorDid: prescriptionData.doctorDid,
      insuranceDid: prescriptionData.insuranceDid,
      prescribedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + (prescriptionData.expiryHours || 720) * 60 * 60 * 1000).toISOString()
    };
    
    // Issue VC using doctor's DID
    return await this.quarkIdAgentService.issueVC(
      prescriptionData.doctorDid,
      'https://health.example/schemas/prescription',
      'Prescription',
      vcData
    );
  }

  private async createTokenTransaction(prescriptionData: any, prescriptionVCId: string) {
    console.log('[PrescriptionTokenService] Creating token transaction for prescription VC:', prescriptionVCId);
    
    // Create unique serial number for the prescription token
    const uniqueData = {
      prescriptionVCId,
      timestamp: Date.now(),
      nonce: Math.random().toString(36).substring(2, 15)
    };
    const serialNumberBytes = Hash.sha256(JSON.stringify(uniqueData));
    const serialNumber = Utils.toHex(serialNumberBytes);
    
    console.log('[PrescriptionTokenService] Generated prescription token serial number:', serialNumber);
    
    // Prepare the prescription VC data for PushDrop
    const prescriptionVCData = {
      vcId: prescriptionVCId,
      medication: prescriptionData.medicationName,
      dosage: prescriptionData.dosage,
      quantity: prescriptionData.quantity,
      instructions: prescriptionData.instructions,
      patientDid: prescriptionData.patientDid,
      doctorDid: prescriptionData.doctorDid
    };
    
    // Build PushDrop fields - serial number and prescription VC data
    const fields: Byte[][] = [
      serialNumberBytes  // Use the raw bytes for the PushDrop field
    ];
    
    // Protocol ID for prescription tokens - similar to DID tokens
    const protocolID: WalletProtocol = [0, 'tm prescription'];
    const keyID: string = serialNumber;
    const counterparty: string = 'self';
    
    // Create the PushDrop locking script
    const pushDropToken = new PushDrop(this.walletClient);
    
    const lock = await pushDropToken.lock(
      fields,
      protocolID,
      keyID,
      counterparty,
      true, // forSelf
      true, // includeSignature
      'before' as "before" | "after"
    );
    
    const lockingScript = lock.toHex();
    
    console.log('[PrescriptionTokenService] Creating BSV transaction with PushDrop output...');
    
    // Create the transaction using wallet client
    const createActionResult = await this.walletClient.createAction({
      description: 'Create prescription token with BSV overlay',
      outputs: [
        {
          satoshis: 1,
          lockingScript: lockingScript,
          outputDescription: 'Prescription PushDrop Token',
          basket: 'prescription-tokens',
          customInstructions: JSON.stringify({
            protocolID: protocolID,
            counterparty: counterparty,
            keyID: keyID,
            fields: fields,
            type: 'PushDrop',
            prescriptionVCData: prescriptionVCData
          })
        }
      ],
      options: {
        randomizeOutputs: false,
      },
      labels: ['prescription-token', 'create']
    });
    
    console.log('[PrescriptionTokenService] Transaction created:', createActionResult.txid);
    
    return {
      ...createActionResult,
      serialNumber,
      prescriptionVCData
    };
  }

  private async createDispensationVC(token: PrescriptionToken, pharmacyDid: string, dispensationData: any): Promise<VerifiableCredential> {
    const vcData = {
      prescriptionReference: token.prescriptionVC.id,
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
      prescriptionReference: token.prescriptionVC.id,
      patient: { did: token.patientDid },
      confirmation: {
        confirmedDate: new Date().toISOString(),
        patientSignature: patientSignature,
        medicationReceived: token.prescriptionVC.credentialSubject.medicationName,
        quantity: token.prescriptionVC.credentialSubject.quantity
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
    console.log(`Finalizing token: ${token.txid}`);
  }
  
  // BSV SDK integration helpers have been removed - now handled by QuarkIdAgentService
}
