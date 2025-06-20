import { IVCSuite, IVCJsonLDKeyPair, Suite } from '@quarkid/kms-core';
import { Purpose } from '@quarkid/did-core';
import { PrivateKey } from '@bsv/sdk';

// Define VerifiableCredential interface locally
interface VerifiableCredential {
  '@context'?: string | string[];
  id?: string;
  type?: string | string[];
  issuer?: string;
  issuanceDate?: string;
  expirationDate?: string;
  credentialSubject?: any;
  proof?: any;
  [key: string]: any; // Allow additional properties
}

export class ES256kVCSuite implements IVCSuite {
  private keyPair?: IVCJsonLDKeyPair;
  private static kmsInstance: any; // Will be set by QuarkIdAgentService

  constructor() {
    console.log('[ES256kVCSuite] Constructor called');
  }

  /**
   * Set the KMS instance to be used for key creation
   */
  static setKMS(kms: any): void {
    console.log('[ES256kVCSuite] Setting KMS instance');
    ES256kVCSuite.kmsInstance = kms;
  }

  /**
   * Create a new key pair using the KMS
   * This method is expected by the agent's KMSClient
   */
  async create(): Promise<IVCJsonLDKeyPair> {
    console.log('[ES256kVCSuite] create called');
    
    if (!ES256kVCSuite.kmsInstance) {
      throw new Error('KMS instance not set. Call ES256kVCSuite.setKMS() first.');
    }

    // Delegate to the BsvWalletKMS createKeyPair method
    // We need to cast to any because createKeyPair is not part of IKMS interface
    const keyPair = await (ES256kVCSuite.kmsInstance as any).createKeyPair(Suite.ES256k);
    console.log('[ES256kVCSuite] Key pair created:', keyPair);
    
    return keyPair;
  }

  /**
   * Load the suite with a key pair
   */
  loadSuite(params: { secrets: IVCJsonLDKeyPair; useCache: boolean }): void {
    console.log('[ES256kVCSuite] loadSuite called with:', {
      secrets: params.secrets,
      useCache: params.useCache
    });
    this.keyPair = params.secrets;
  }

  /**
   * Sign a verifiable credential
   */
  async sign(
    documentToSign: any,
    did: string,
    verificationMethodId: string,
    purpose: Purpose
  ): Promise<VerifiableCredential> {
    console.log('[ES256kVCSuite] sign called with:', {
      documentToSign,
      did,
      verificationMethodId,
      purpose
    });

    if (!this.keyPair || !this.keyPair.privateKey) {
      throw new Error('No key pair loaded or no private key available');
    }

    try {
      // Convert the document to a string for signing
      const message = typeof documentToSign === 'string' 
        ? documentToSign 
        : JSON.stringify(documentToSign);

      // The privateKey from IVCJsonLDKeyPair should be in WIF format
      const privKey = PrivateKey.fromWif(this.keyPair.privateKey);
      
      // Sign the message
      const messageBuffer = Buffer.from(message, 'utf8');
      const signature = privKey.sign(Array.from(messageBuffer));
      
      // Create the signed VC with the proof
      const signedVC: VerifiableCredential = {
        ...documentToSign,
        proof: {
          type: 'EcdsaSecp256k1Signature2019',
          created: new Date().toISOString(),
          proofPurpose: purpose.name || 'assertionMethod',
          verificationMethod: verificationMethodId,
          jws: signature.toDER('hex')
        }
      };

      console.log('[ES256kVCSuite] Successfully signed VC');
      return signedVC;
    } catch (error) {
      console.error('[ES256kVCSuite] Error signing VC:', error);
      throw new Error(`Failed to sign VC: ${error.message}`);
    }
  }
}
