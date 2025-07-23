import { DWNStorageService, DWNMessage } from './DWNStorageService';
import { QuarkIdAgentService } from './quarkIdAgentService';
import * as crypto from 'crypto';

/**
 * Prescription DWN Service for secure VC transmission
 * 
 * This service handles the secure transmission of prescription VCs between
 * doctors, pharmacies, and patients using the DWN (Decentralized Web Node) protocol.
 * All messages are stored in the same storage backend as the BSV wallet.
 */
export class PrescriptionDWNService {
  private dwnStorage: DWNStorageService;
  private quarkIdAgent: QuarkIdAgentService;

  constructor(
    dwnStorage: DWNStorageService,
    quarkIdAgent: QuarkIdAgentService
  ) {
    this.dwnStorage = dwnStorage;
    this.quarkIdAgent = quarkIdAgent;
  }

  /**
   * Send prescription VC to patient after doctor creates it
   */
  async sendPrescriptionToPatient(
    doctorDid: string,
    patientDid: string,
    prescriptionVC: any,
    prescriptionId: string
  ): Promise<string> {
    try {
      console.log('[PrescriptionDWNService] Sending prescription VC to patient:', patientDid);

      // Encrypt the VC for the patient
      const encryptedVC = await this.encryptVCForRecipient(prescriptionVC, patientDid);

      // Create DWN message
      const message: DWNMessage = {
        id: crypto.randomUUID(),
        type: 'prescription',
        from: doctorDid,
        to: patientDid,
        subject: `New Prescription: ${prescriptionVC.credentialSubject.prescription.medication.name}`,
        encryptedPayload: encryptedVC,
        timestamp: new Date(),
        threadId: prescriptionId, // Group all prescription-related messages
        metadata: {
          prescriptionId,
          vcType: 'PrescriptionCredential',
          urgent: false
        }
      };

      // Store in DWN
      await this.dwnStorage.storeMessage(message);

      console.log('[PrescriptionDWNService] Prescription VC sent successfully:', message.id);
      return message.id;
    } catch (error) {
      console.error('[PrescriptionDWNService] Error sending prescription VC:', error);
      throw new Error(`Failed to send prescription VC: ${error.message}`);
    }
  }

  /**
   * Send dispensation VC to patient after pharmacy dispenses medication
   */
  async sendDispensationToPatient(
    pharmacyDid: string,
    patientDid: string,
    dispensationVC: any,
    prescriptionId: string
  ): Promise<string> {
    try {
      console.log('[PrescriptionDWNService] Sending dispensation VC to patient:', patientDid);

      // Encrypt the VC for the patient
      const encryptedVC = await this.encryptVCForRecipient(dispensationVC, patientDid);

      // Create DWN message
      const message: DWNMessage = {
        id: crypto.randomUUID(),
        type: 'dispensation',
        from: pharmacyDid,
        to: patientDid,
        subject: `Medication Dispensed: ${dispensationVC.credentialSubject.prescription.medication.name}`,
        encryptedPayload: encryptedVC,
        timestamp: new Date(),
        threadId: prescriptionId, // Same thread as prescription
        metadata: {
          prescriptionId,
          vcType: 'DispensationCredential',
          urgent: false
        }
      };

      // Store in DWN
      await this.dwnStorage.storeMessage(message);

      console.log('[PrescriptionDWNService] Dispensation VC sent successfully:', message.id);
      return message.id;
    } catch (error) {
      console.error('[PrescriptionDWNService] Error sending dispensation VC:', error);
      throw new Error(`Failed to send dispensation VC: ${error.message}`);
    }
  }

  /**
   * Send confirmation VC to doctor and pharmacy after patient confirms receipt
   */
  async sendConfirmationToProviders(
    patientDid: string,
    doctorDid: string,
    pharmacyDid: string,
    confirmationVC: any,
    prescriptionId: string
  ): Promise<{ doctorMessageId: string; pharmacyMessageId: string }> {
    try {
      console.log('[PrescriptionDWNService] Sending confirmation VC to providers');

      // Encrypt the VC for each recipient
      const encryptedVCForDoctor = await this.encryptVCForRecipient(confirmationVC, doctorDid);
      const encryptedVCForPharmacy = await this.encryptVCForRecipient(confirmationVC, pharmacyDid);

      // Create message for doctor
      const doctorMessage: DWNMessage = {
        id: crypto.randomUUID(),
        type: 'confirmation',
        from: patientDid,
        to: doctorDid,
        subject: 'Patient Confirmed Medication Receipt',
        encryptedPayload: encryptedVCForDoctor,
        timestamp: new Date(),
        threadId: prescriptionId,
        metadata: {
          prescriptionId,
          vcType: 'ConfirmationCredential',
          urgent: false
        }
      };

      // Create message for pharmacy
      const pharmacyMessage: DWNMessage = {
        id: crypto.randomUUID(),
        type: 'confirmation',
        from: patientDid,
        to: pharmacyDid,
        subject: 'Patient Confirmed Medication Receipt',
        encryptedPayload: encryptedVCForPharmacy,
        timestamp: new Date(),
        threadId: prescriptionId,
        metadata: {
          prescriptionId,
          vcType: 'ConfirmationCredential',
          urgent: false
        }
      };

      // Store both messages in DWN
      await Promise.all([
        this.dwnStorage.storeMessage(doctorMessage),
        this.dwnStorage.storeMessage(pharmacyMessage)
      ]);

      console.log('[PrescriptionDWNService] Confirmation VCs sent successfully');
      return {
        doctorMessageId: doctorMessage.id,
        pharmacyMessageId: pharmacyMessage.id
      };
    } catch (error) {
      console.error('[PrescriptionDWNService] Error sending confirmation VC:', error);
      throw new Error(`Failed to send confirmation VC: ${error.message}`);
    }
  }

  /**
   * Get all prescription-related messages for a DID
   */
  async getPrescriptionMessages(
    did: string,
    prescriptionId?: string
  ): Promise<DWNMessage[]> {
    try {
      const filters: any = {};
      
      if (prescriptionId) {
        filters.threadId = prescriptionId;
      }

      return await this.dwnStorage.getMessages(did, filters);
    } catch (error) {
      console.error('[PrescriptionDWNService] Error getting prescription messages:', error);
      throw new Error(`Failed to get prescription messages: ${error.message}`);
    }
  }

  /**
   * Get prescription thread (all messages for a specific prescription)
   */
  async getPrescriptionThread(
    participantDid: string,
    prescriptionId: string
  ): Promise<DWNMessage[]> {
    try {
      return await this.dwnStorage.getMessages(participantDid, {
        threadId: prescriptionId
      });
    } catch (error) {
      console.error('[PrescriptionDWNService] Error getting prescription thread:', error);
      throw new Error(`Failed to get prescription thread: ${error.message}`);
    }
  }

  /**
   * Decrypt and retrieve a specific prescription message
   */
  async getPrescriptionMessage(
    messageId: string,
    recipientDid: string
  ): Promise<{
    message: DWNMessage;
    decryptedVC: any;
  } | null> {
    try {
      const message = await this.dwnStorage.getMessage(messageId, recipientDid);
      if (!message) {
        return null;
      }

      // Decrypt the VC
      const decryptedVC = await this.decryptVCFromRecipient(message.encryptedPayload, recipientDid);

      return {
        message,
        decryptedVC
      };
    } catch (error) {
      console.error('[PrescriptionDWNService] Error getting prescription message:', error);
      throw new Error(`Failed to get prescription message: ${error.message}`);
    }
  }

  /**
   * Mark a prescription message as read
   */
  async markPrescriptionMessageAsRead(
    messageId: string,
    recipientDid: string
  ): Promise<boolean> {
    try {
      return await this.dwnStorage.markMessageAsRead(messageId, recipientDid);
    } catch (error) {
      console.error('[PrescriptionDWNService] Error marking message as read:', error);
      return false;
    }
  }

  /**
   * Get prescription message statistics for a DID
   */
  async getPrescriptionStats(did: string): Promise<{
    totalReceived: number;
    totalSent: number;
    unread: number;
    prescriptions: number;
    dispensations: number;
    confirmations: number;
  }> {
    try {
      const stats = await this.dwnStorage.getMessageStats(did);
      
      return {
        totalReceived: stats.totalReceived,
        totalSent: stats.totalSent,
        unread: stats.unread,
        prescriptions: stats.typeBreakdown.prescription || 0,
        dispensations: stats.typeBreakdown.dispensation || 0,
        confirmations: stats.typeBreakdown.confirmation || 0
      };
    } catch (error) {
      console.error('[PrescriptionDWNService] Error getting prescription stats:', error);
      throw new Error(`Failed to get prescription statistics: ${error.message}`);
    }
  }

  /**
   * Encrypt VC for a specific recipient using their DID
   */
  private async encryptVCForRecipient(vc: any, recipientDid: string): Promise<string> {
    try {
      // In a production implementation, this would:
      // 1. Resolve the recipient's DID document
      // 2. Extract their public key for encryption
      // 3. Use proper asymmetric encryption (e.g., ECIES)
      
      // For now, we'll use a simplified approach
      const vcString = JSON.stringify(vc);
      const encrypted = Buffer.from(vcString).toString('base64');
      
      // Add recipient DID to track who can decrypt this
      return `encrypted:${recipientDid}:${encrypted}`;
    } catch (error) {
      console.error('[PrescriptionDWNService] Error encrypting VC:', error);
      throw new Error('Failed to encrypt VC');
    }
  }

  /**
   * Decrypt VC from recipient's perspective
   */
  private async decryptVCFromRecipient(encryptedPayload: string, recipientDid: string): Promise<any> {
    try {
      // Parse the simplified encrypted format
      const parts = encryptedPayload.split(':');
      if (parts.length !== 3 || parts[0] !== 'encrypted') {
        throw new Error('Invalid encrypted payload format');
      }

      const [, did, encryptedData] = parts;
      if (did !== recipientDid) {
        throw new Error('Encrypted payload not intended for this recipient');
      }

      // Simplified decryption - in production, use proper private key decryption
      const decrypted = Buffer.from(encryptedData, 'base64').toString('utf8');
      return JSON.parse(decrypted);
    } catch (error) {
      console.error('[PrescriptionDWNService] Error decrypting VC:', error);
      throw new Error('Failed to decrypt VC');
    }
  }
}

/**
 * Factory function to create PrescriptionDWNService
 */
export function createPrescriptionDWNService(
  dwnStorage: DWNStorageService,
  quarkIdAgent: QuarkIdAgentService
): PrescriptionDWNService {
  return new PrescriptionDWNService(dwnStorage, quarkIdAgent);
}