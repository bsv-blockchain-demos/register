// src/services/qrService.ts
import QRCode from 'qrcode';
import type { QRCodeData, Actor, VerifiableCredential, BSVToken, EncryptedData } from '../types';
import { encryptionService } from './encryptionService';

/**
 * Service for generating and parsing QR codes
 */
class QRService {
  /**
   * Generate a QR code for an actor's DID
   */
  async generateActorQR(actor: Actor): Promise<string> {
    const qrData: QRCodeData = {
      type: 'actor_did',
      data: {
        did: actor.did
      },
      timestamp: new Date().toISOString()
    };

    const qrString = JSON.stringify(qrData);
    
    try {
      const qrCodeDataURL = await QRCode.toDataURL(qrString, {
        errorCorrectionLevel: 'M',
        type: 'image/png',
        margin: 1,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });
      
      return qrCodeDataURL;
    } catch (error) {
      console.error('QR code generation failed:', error);
      throw new Error('Failed to generate QR code');
    }
  }

  /**
   * Generate a QR code for a Verifiable Credential (encrypted)
   */
  async generateVCQR(
    vc: VerifiableCredential, 
    recipientPublicKey: string
  ): Promise<string> {
    const vcString = JSON.stringify(vc);
    const encryptedVC = encryptionService.encryptWithPublicKey(vcString, recipientPublicKey);

    const qrData: QRCodeData = {
      type: 'prescription_vc',
      data: {
        vcData: encryptedVC,
        encryptedWith: recipientPublicKey
      },
      timestamp: new Date().toISOString()
    };

    const qrString = JSON.stringify(qrData);
    
    try {
      const qrCodeDataURL = await QRCode.toDataURL(qrString, {
        errorCorrectionLevel: 'L', // Lower correction for more data
        type: 'image/png',
        margin: 1
      });
      
      return qrCodeDataURL;
    } catch (error) {
      console.error('VC QR code generation failed:', error);
      throw new Error('Failed to generate VC QR code');
    }
  }

  /**
   * Generate a QR code for BSV token transfer
   */
  async generateTokenQR(token: BSVToken, recipientDid: string): Promise<string> {
    const qrData: QRCodeData = {
      type: 'token_transfer',
      data: {
        tokenData: token,
        did: recipientDid
      },
      timestamp: new Date().toISOString()
    };

    const qrString = JSON.stringify(qrData);
    
    try {
      const qrCodeDataURL = await QRCode.toDataURL(qrString, {
        errorCorrectionLevel: 'M',
        type: 'image/png',
        margin: 1
      });
      
      return qrCodeDataURL;
    } catch (error) {
      console.error('Token QR code generation failed:', error);
      throw new Error('Failed to generate token QR code');
    }
  }

  /**
   * Parse QR code data
   */
  parseQRData(qrString: string): QRCodeData {
    try {
      const qrData = JSON.parse(qrString) as QRCodeData;
      
      // Validate the QR data structure
      if (!qrData.type || !qrData.data || !qrData.timestamp) {
        throw new Error('Invalid QR code format');
      }

      // Check if QR code is not too old (24 hours)
      const qrTime = new Date(qrData.timestamp).getTime();
      const now = Date.now();
      const hoursDiff = (now - qrTime) / (1000 * 60 * 60);
      
      if (hoursDiff > 24) {
        throw new Error('QR code has expired');
      }

      return qrData;
    } catch (error) {
      console.error('QR parsing failed:', error);
      throw new Error('Failed to parse QR code');
    }
  }

  /**
   * Decrypt a VC from QR data
   */
  decryptVCFromQR(qrData: QRCodeData, privateKey: string): VerifiableCredential {
    if (qrData.type !== 'prescription_vc' || !qrData.data.vcData) {
      throw new Error('QR code does not contain a VC');
    }

    try {
      const encryptedData = qrData.data.vcData as EncryptedData;
      const decryptedString = encryptionService.decryptWithPrivateKey(encryptedData, privateKey);
      const vc = JSON.parse(decryptedString) as VerifiableCredential;
      
      return vc;
    } catch (error) {
      console.error('VC decryption failed:', error);
      throw new Error('Failed to decrypt VC from QR code');
    }
  }

  /**
   * Generate QR code as SVG string (for inline embedding)
   */
  async generateQRSVG(data: string): Promise<string> {
    try {
      const svgString = await QRCode.toString(data, {
        type: 'svg',
        errorCorrectionLevel: 'M',
        margin: 1,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });
      
      return svgString;
    } catch (error) {
      console.error('SVG QR generation failed:', error);
      throw new Error('Failed to generate SVG QR code');
    }
  }

  /**
   * Generate a simple text QR code for testing
   */
  async generateTextQR(text: string): Promise<string> {
    try {
      const qrCodeDataURL = await QRCode.toDataURL(text, {
        errorCorrectionLevel: 'M',
        type: 'image/png',
        margin: 1
      });
      
      return qrCodeDataURL;
    } catch (error) {
      console.error('Text QR generation failed:', error);
      throw new Error('Failed to generate text QR code');
    }
  }

  /**
   * Validate DID format
   */
  validateDID(did: string): boolean {
    // Basic BSV DID format validation: did:bsv:topic:txid:vout
    const didPattern = /^did:bsv:[a-fA-F0-9]+:[a-fA-F0-9]{64}:\d+$/;
    return didPattern.test(did);
  }

  /**
   * Extract information from BSV DID
   */
  parseBSVDID(did: string): { topic: string; txid: string; vout: number } | null {
    if (!this.validateDID(did)) {
      return null;
    }

    const parts = did.split(':');
    return {
      topic: parts[2],
      txid: parts[3],
      vout: parseInt(parts[4], 10)
    };
  }
}

export const qrService = new QRService();
