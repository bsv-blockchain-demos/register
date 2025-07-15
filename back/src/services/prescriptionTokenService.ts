import { Db } from 'mongodb';
import crypto from 'crypto';
import { Script, OP, Hash, Utils, PushDrop, WalletProtocol, Byte } from '@bsv/sdk';
import { KMSClient } from '@quarkid/kms-client';

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

// Fraud prevention interface
interface FraudPreventionData {
  fraudScore: number;
  fraudRisk: 'low' | 'medium' | 'high';
  fraudAlerts: string[];
  insuranceNotified: boolean;
  selectiveDisclosureEnabled: boolean;
  bbsPlusSignatureUsed: boolean;
}

/**
 * Enhanced prescription token using BSV overlay with push-drop mechanics
 * Now includes integrated fraud prevention with BBS+ selective disclosure
 */
export interface PrescriptionToken {
  id: string;
  txid: string;
  status: 'created' | 'dispensing' | 'dispensed' | 'confirmed' | 'expired';
  prescriptionVC: VerifiableCredential;
  patientDid: string;
  doctorDid: string;
  pharmacyDid: string | null;
  insuranceDid?: string;
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
  fraudPrevention: FraudPreventionData;
  selectiveDisclosureFrames: {
    insurance: any;
    pharmacy: any;
    audit: any;
  };
  blockchainAnchor: {
    txid: string;
    proofHash: string;
    timestamp: string;
  };
}

/**
 * Enhanced prescription token service with real BSV overlay integration
 * Now includes integrated fraud prevention with BBS+ selective disclosure
 */
export class PrescriptionTokenService {
  private db: Db;
  private walletClient: any;
  private overlayConfig: any;
  private quarkIdAgentService: any;
  private kmsClient: KMSClient;
  private vcTokenService: any;
  private tokensCollection: any;
  private fraudPreventionService: any;

  constructor(
    db: Db, 
    walletClient: any, 
    overlayConfig: any,
    quarkIdAgentService: any,
    kmsClient: KMSClient,
    fraudPreventionService?: any,
    vcTokenService?: any
  ) {
    this.db = db;
    this.walletClient = walletClient;
    this.overlayConfig = overlayConfig;
    this.quarkIdAgentService = quarkIdAgentService;
    this.kmsClient = kmsClient;
    this.fraudPreventionService = fraudPreventionService;
    this.vcTokenService = vcTokenService;
    
    this.tokensCollection = db.collection('prescription_tokens');
  }

  // Selective disclosure frames for different actor types
  private static readonly DISCLOSURE_FRAMES = {
    insurance: {
      '@context': 'https://www.w3.org/2018/credentials/v1',
      '@type': 'VerifiableCredential',
      credentialSubject: {
        '@type': 'PrescriptionCredential',
        prescription: {
          id: {},
          medicationName: {},
          cost: {},
          insuranceProvider: {},
          prescribedDate: {},
          status: {}
        },
        patient: {
          insuranceNumber: {},
          insuranceProvider: {}
        },
        doctor: {
          licenseNumber: {},
          specialization: {}
        }
      }
    },
    pharmacy: {
      '@context': 'https://www.w3.org/2018/credentials/v1',
      '@type': 'VerifiableCredential',
      credentialSubject: {
        '@type': 'PrescriptionCredential',
        prescription: {
          id: {},
          medicationName: {},
          dosage: {},
          quantity: {},
          instructions: {},
          refills: {},
          validUntil: {},
          status: {}
        },
        patient: {
          name: {},
          birthDate: {},
          contactInfo: {}
        },
        doctor: {
          name: {},
          licenseNumber: {},
          contactInfo: {}
        }
      }
    },
    audit: {
      '@context': 'https://www.w3.org/2018/credentials/v1',
      '@type': 'VerifiableCredential',
      credentialSubject: {
        '@type': 'PrescriptionCredential',
        prescription: {},
        patient: {},
        doctor: {}
      }
    }
  };

  /**
   * Create prescription token with real BSV transaction and VCs
   * Now includes integrated fraud prevention with BBS+ selective disclosure
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
    // Additional fields for fraud prevention
    patientInfo?: {
      name: string;
      birthDate: string;
      insuranceNumber?: string;
      contactInfo?: string;
    };
    doctorInfo?: {
      name: string;
      licenseNumber: string;
      specialization: string;
      contactInfo?: string;
    };
  }): Promise<PrescriptionToken> {
    
    try {
      console.log('[PrescriptionTokenService] Creating prescription token with fraud prevention...');
      
      // 1. Create prescription VC with BBS+ signature
      const prescriptionVC = await this.createPrescriptionVCWithBBSPlus(prescriptionData);
      
      // 2. Calculate fraud score and perform risk assessment
      const fraudScore = await this.calculateFraudScore(prescriptionData);
      const fraudRisk = fraudScore >= 50 ? 'high' : fraudScore >= 25 ? 'medium' : 'low';
      
      // 3. Create selective disclosure frames
      const selectiveDisclosureFrames = {
        insurance: PrescriptionTokenService.DISCLOSURE_FRAMES.insurance,
        pharmacy: PrescriptionTokenService.DISCLOSURE_FRAMES.pharmacy,
        audit: PrescriptionTokenService.DISCLOSURE_FRAMES.audit
      };
      
      // 4. Create BSV token with push-drop mechanics and fraud prevention metadata
      const tokenTx = await this.createTokenTransactionWithFraudPrevention(
        prescriptionData, 
        prescriptionVC.id, 
        fraudScore,
        selectiveDisclosureFrames
      );
      
      // 5. Generate blockchain anchor for proof
      const blockchainAnchor = {
        txid: tokenTx.txid,
        proofHash: crypto.createHash('sha256').update(JSON.stringify(prescriptionVC)).digest('hex'),
        timestamp: new Date().toISOString()
      };
      
      // 6. Store token record with fraud prevention data
      const token: PrescriptionToken = {
        id: crypto.randomUUID(),
        txid: tokenTx.txid,
        prescriptionVC,
        status: 'created',
        patientDid: prescriptionData.patientDid,
        doctorDid: prescriptionData.doctorDid,
        pharmacyDid: null,
        insuranceDid: prescriptionData.insuranceDid,
        createdAt: new Date(),
        updatedAt: new Date(),
        tokenState: {
          owner: prescriptionData.patientDid,
          canDispense: true,
          dispensedAt: null,
          confirmedAt: null
        },
        fraudPrevention: {
          fraudScore,
          fraudRisk,
          fraudAlerts: fraudScore >= 50 ? ['HIGH_FRAUD_SCORE'] : [],
          insuranceNotified: Boolean(prescriptionData.insuranceDid),
          selectiveDisclosureEnabled: true,
          bbsPlusSignatureUsed: true
        },
        selectiveDisclosureFrames,
        blockchainAnchor
      };
      
      // 7. Store in database
      await this.db.collection('prescription_tokens').insertOne(token);
      
      // 8. Notify insurance company if provided
      if (prescriptionData.insuranceDid) {
        await this.notifyInsuranceCompany(prescriptionData.insuranceDid, token);
      }
      
      // 9. Log fraud alerts if high risk
      if (fraudRisk === 'high') {
        console.warn(`[FRAUD ALERT] High fraud score detected: ${fraudScore}`, {
          prescriptionId: token.id,
          patientDid: prescriptionData.patientDid,
          doctorDid: prescriptionData.doctorDid,
          medicationName: prescriptionData.medicationName,
          timestamp: new Date().toISOString()
        });
      }
      
      console.log('[PrescriptionTokenService] Prescription token created with fraud prevention');
      
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

    // Allow dispensing for prescriptions that have been shared (status: dispensing)
    if (token.status !== 'dispensing') {
      throw new Error(`Cannot dispense prescription in status: ${token.status}. Prescription must be shared with pharmacy first.`);
    }

    // Verify the pharmacy trying to dispense is the one the prescription was shared with
    if (token.pharmacyDid !== pharmacyDid) {
      throw new Error('Unauthorized: This prescription was not shared with your pharmacy');
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
    return await this.tokensCollection.find({ pharmacyDid }).toArray();
  }

  /**
   * Get tokens by insurance DID
   */
  async getTokensByInsurance(insuranceDid: string): Promise<PrescriptionToken[]> {
    return await this.tokensCollection.find({ insuranceDid }).toArray();
  }

  /**
   * Share prescription token with a pharmacy
   * This updates the token to associate it with a pharmacy for dispensing
   */
  async sharePrescriptionToken(
    tokenId: string,
    patientDid: string,
    pharmacyDid: string
  ): Promise<PrescriptionToken> {
    try {
      // 1. Get the token
      const token = await this.getToken(tokenId);
      if (!token) {
        throw new Error('Prescription token not found');
      }

      // 2. Verify the patient owns this prescription
      if (token.patientDid !== patientDid) {
        throw new Error('Unauthorized: Patient does not own this prescription');
      }

      // 3. Check if prescription is in a valid state for sharing
      if (token.status !== 'created') {
        throw new Error(`Cannot share prescription in ${token.status} status`);
      }

      // 4. Check if already shared with a pharmacy
      if (token.pharmacyDid) {
        throw new Error('Prescription already shared with a pharmacy');
      }

      // 5. Update token with pharmacy DID
      const updatedToken = {
        ...token,
        pharmacyDid: pharmacyDid,
        status: 'dispensing' as const,
        updatedAt: new Date()
      };

      // 6. Update in database
      await this.tokensCollection.updateOne(
        { id: tokenId },
        { 
          $set: { 
            pharmacyDid: pharmacyDid,
            status: 'dispensing',
            updatedAt: new Date()
          } 
        }
      );

      console.log(`[PrescriptionTokenService] Token ${tokenId} shared with pharmacy ${pharmacyDid}`);
      return updatedToken;

    } catch (error) {
      console.error('[PrescriptionTokenService] Error sharing prescription token:', error);
      throw error;
    }
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

  /**
   * Create prescription VC with BBS+ signature for selective disclosure
   */
  private async createPrescriptionVCWithBBSPlus(prescriptionData: any): Promise<VerifiableCredential> {
    const vcData = {
      prescription: {
        id: crypto.randomUUID(),
        medicationName: prescriptionData.medicationName,
        dosage: prescriptionData.dosage,
        quantity: prescriptionData.quantity,
        instructions: prescriptionData.instructions,
        refills: 0,
        validUntil: new Date(Date.now() + (prescriptionData.expiryHours || 720) * 60 * 60 * 1000).toISOString(),
        diagnosisCode: prescriptionData.diagnosisCode,
        prescribedDate: new Date().toISOString(),
        status: 'active',
        cost: Math.round(Math.random() * 100 + 20), // Mock cost
        insuranceProvider: prescriptionData.insuranceDid || 'self-pay'
      },
      patient: {
        id: prescriptionData.patientDid,
        name: prescriptionData.patientInfo?.name || 'Unknown',
        birthDate: prescriptionData.patientInfo?.birthDate || '1990-01-01',
        insuranceNumber: prescriptionData.patientInfo?.insuranceNumber || '',
        insuranceProvider: prescriptionData.insuranceDid || 'self-pay',
        contactInfo: prescriptionData.patientInfo?.contactInfo || ''
      },
      doctor: {
        id: prescriptionData.doctorDid,
        name: prescriptionData.doctorInfo?.name || 'Unknown',
        licenseNumber: prescriptionData.doctorInfo?.licenseNumber || '',
        specialization: prescriptionData.doctorInfo?.specialization || 'General',
        contactInfo: prescriptionData.doctorInfo?.contactInfo || ''
      }
    };
    
    // Use VCTokenService to create BBS+ signed credential
    console.log('[PrescriptionTokenService] Creating BBS+ signed credential...');
    
    if (!this.vcTokenService) {
      throw new Error('VCTokenService not available - required for BBS+ signature');
    }
    
    const vcToken = await this.vcTokenService.createVCToken({
      issuerDid: prescriptionData.doctorDid,
      subjectDid: prescriptionData.patientDid,
      credentialType: 'PrescriptionCredential',
      claims: vcData,
      metadata: {
        description: `Prescription for ${prescriptionData.medicationName}`,
        customData: {
          useBBSSignature: true,
          enableSelectiveDisclosure: true
        }
      }
    });
    
    console.log('[PrescriptionTokenService] BBS+ signed credential created successfully');
    
    return vcToken.vc;
  }

  /**
   * Calculate fraud score based on prescription data
   */
  private async calculateFraudScore(prescriptionData: any): Promise<number> {
    let score = 0;
    
    // Check for high-risk medications
    const highRiskMeds = ['oxycodone', 'morphine', 'fentanyl', 'adderall', 'xanax'];
    if (highRiskMeds.some(med => prescriptionData.medicationName.toLowerCase().includes(med))) {
      score += 30;
    }
    
    // Check for unusual quantity
    if (prescriptionData.quantity > 100) {
      score += 25;
    }
    
    // Check for multiple prescriptions (would need additional context)
    // This is simplified - in real implementation, check against patient history
    score += Math.floor(Math.random() * 20); // Random component for demo
    
    // Check for doctor/patient relationship history
    // This is simplified - in real implementation, check against database
    const hasHistory = Math.random() > 0.3; // 70% chance of history
    if (!hasHistory) {
      score += 15;
    }
    
    return Math.min(score, 100); // Cap at 100
  }

  /**
   * Create BSV token transaction with fraud prevention metadata
   */
  private async createTokenTransactionWithFraudPrevention(
    prescriptionData: any, 
    prescriptionVCId: string,
    fraudScore: number,
    selectiveDisclosureFrames: any
  ) {
    console.log('[PrescriptionTokenService] Creating token transaction with fraud prevention metadata...');
    
    // Create unique serial number for the prescription token
    const uniqueData = {
      prescriptionVCId,
      timestamp: Date.now(),
      nonce: Math.random().toString(36).substring(2, 15)
    };
    const serialNumberBytes = Hash.sha256(JSON.stringify(uniqueData));
    const serialNumber = Utils.toHex(serialNumberBytes);
    
    console.log('[PrescriptionTokenService] Generated prescription token serial number:', serialNumber);
    
    // Prepare the prescription VC data for PushDrop with fraud prevention metadata
    const prescriptionVCData = {
      vcId: prescriptionVCId,
      medication: prescriptionData.medicationName,
      dosage: prescriptionData.dosage,
      quantity: prescriptionData.quantity,
      instructions: prescriptionData.instructions,
      patientDid: prescriptionData.patientDid,
      doctorDid: prescriptionData.doctorDid,
      insuranceDid: prescriptionData.insuranceDid,
      // Fraud prevention metadata
      fraudScore,
      fraudRisk: fraudScore >= 50 ? 'high' : fraudScore >= 25 ? 'medium' : 'low',
      selectiveDisclosureEnabled: true,
      bbsPlusSignatureUsed: true,
      selectiveDisclosureFrames: Object.keys(selectiveDisclosureFrames)
    };
    
    // Build PushDrop fields - serial number and prescription VC data
    const fields: Byte[][] = [
      serialNumberBytes  // Use the raw bytes for the PushDrop field
    ];
    
    // Protocol ID for prescription tokens with fraud prevention
    const protocolID: WalletProtocol = [0, 'tm prescription fp'];
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
    
    console.log('[PrescriptionTokenService] Creating BSV transaction with fraud prevention PushDrop output...');
    
    // Create the transaction using wallet client
    const createActionResult = await this.walletClient.createAction({
      description: 'Create prescription token with BSV overlay and fraud prevention',
      outputs: [
        {
          satoshis: 1,
          lockingScript: lockingScript,
          outputDescription: 'Prescription PushDrop Token with Fraud Prevention',
          basket: 'prescription-tokens-fp',
          customInstructions: JSON.stringify({
            protocolID: protocolID,
            counterparty: counterparty,
            keyID: keyID,
            fields: fields,
            type: 'PushDrop',
            prescriptionVCData: prescriptionVCData,
            fraudPrevention: {
              enabled: true,
              fraudScore,
              bbsPlusSignature: true,
              selectiveDisclosure: true
            }
          })
        }
      ],
      options: {
        randomizeOutputs: false,
      },
      labels: ['prescription-token', 'fraud-prevention', 'create']
    });
    
    console.log('[PrescriptionTokenService] Transaction created with fraud prevention:', createActionResult.txid);
    
    return {
      ...createActionResult,
      serialNumber,
      prescriptionVCData
    };
  }

  /**
   * Notify insurance company about new prescription
   */
  private async notifyInsuranceCompany(insuranceDid: string, token: PrescriptionToken): Promise<void> {
    try {
      console.log(`[PrescriptionTokenService] Notifying insurance company ${insuranceDid} about prescription ${token.id}`);
      
      // Create insurance-specific selective disclosure
      const insuranceDisclosure = await this.kmsClient.deriveVC({
        vc: token.prescriptionVC,
        frame: PrescriptionTokenService.DISCLOSURE_FRAMES.insurance
      });
      
      // Store insurance notification
      await this.db.collection('insurance_notifications').insertOne({
        insuranceDid,
        prescriptionTokenId: token.id,
        patientDid: token.patientDid,
        doctorDid: token.doctorDid,
        fraudScore: token.fraudPrevention.fraudScore,
        fraudRisk: token.fraudPrevention.fraudRisk,
        selectiveDisclosure: insuranceDisclosure,
        notifiedAt: new Date(),
        status: 'pending',
        type: 'prescription_created'
      });
      
      console.log(`[PrescriptionTokenService] Insurance notification stored for ${insuranceDid}`);
      
    } catch (error) {
      console.error(`[PrescriptionTokenService] Error notifying insurance company:`, error);
      // Don't throw error - notification failure shouldn't prevent prescription creation
    }
  }

  /**
   * Get selective disclosure for specific actor type
   */
  async getSelectiveDisclosure(tokenId: string, actorType: 'insurance' | 'pharmacy' | 'audit'): Promise<any> {
    const token = await this.getToken(tokenId);
    if (!token) {
      throw new Error('Prescription token not found');
    }
    
    const frame = PrescriptionTokenService.DISCLOSURE_FRAMES[actorType];
    if (!frame) {
      throw new Error(`Invalid actor type: ${actorType}`);
    }
    
    return await this.kmsClient.deriveVC({
      vc: token.prescriptionVC,
      frame
    });
  }
  
  // BSV SDK integration helpers have been removed - now handled by QuarkIdAgentService
}
