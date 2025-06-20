import { IKMS, Suite, IJWK, IVCJsonLDKeyPair } from '@quarkid/kms-core';
import { WalletClient, PrivateKey, PublicKey, Signature } from '@bsv/sdk';
import { Purpose, DIDCommMessage } from '@quarkid/did-core';
import { VerifiableCredential } from '@quarkid/vc-core';
import { 
  IDIDCommMessage, 
  IPackedDIDCommMessage,
  DIDCommMessagePacking
} from '@quarkid/kms-core/dist/models/suites/didcomm/didcomm-message-media-type';
import { IKeyPair } from '@quarkid/kms-core/dist/models/keypair';

/**
 * BSV Wallet KMS implementation for QuarkID Agent
 * 
 * This KMS bridges the BSV wallet with QuarkID's expected KMS interface,
 * allowing the agent to use wallet-managed keys for DID and VC operations.
 */
export class BsvWalletKMS implements IKMS {
  private walletClient: WalletClient;
  private keyStore: Map<string, { privateKey: string; publicKey: string; jwk: IJWK; keyId: string }> = new Map();

  constructor(walletClient: WalletClient) {
    this.walletClient = walletClient;
  }

  /**
   * Create a new key pair and return as JWK (IKMS interface requirement)
   */
  async create(suite: Suite): Promise<{ publicKeyJWK: IJWK }> {
    const keyPair = await this.createKeyPair(suite);
    return { publicKeyJWK: keyPair.publicKeyJWK };
  }

  /**
   * Create a new key pair and return the full key pair data
   * Used internally by ES256kVCSuite
   */
  async createKeyPair(suite: Suite): Promise<IVCJsonLDKeyPair> {
    try {
      // Generate a new private key using BSV SDK
      const privateKey = PrivateKey.fromRandom();
      const publicKey = privateKey.toPublicKey();
      
      // Since PublicKey extends Point, it should have x and y properties
      // These are BigNumber objects that need to be converted to bytes
      const xBigNum = (publicKey as any).x;
      const yBigNum = (publicKey as any).y;
      
      // Convert BigNumber to byte arrays (32 bytes each for secp256k1)
      const xBytes = xBigNum.toArray('be', 32);
      const yBytes = yBigNum.toArray('be', 32);
      
      // Convert to base64url for JWK
      const xBase64 = Buffer.from(xBytes).toString('base64url');
      const yBase64 = Buffer.from(yBytes).toString('base64url');
      
      // Create JWK representation
      const publicKeyJWK: IJWK = {
        kty: 'EC',
        crv: 'secp256k1',
        x: xBase64,
        y: yBase64
      };
      
      // Generate keyId consistently with how it's done in BsvOverlayRegistryAdapter
      const keyId = `did:bsv:${xBase64.substring(0, 16)}`;
      
      // Store the key pair with JWK and keyId
      this.keyStore.set(keyId, {
        privateKey: privateKey.toWif(),
        publicKey: publicKey.toDER('hex') as string,
        jwk: publicKeyJWK,
        keyId: keyId
      });

      console.log('[BsvWalletKMS] Created key with ID:', keyId);
      console.log('[BsvWalletKMS] JWK x coordinate (first 16 chars):', xBase64.substring(0, 16));
      console.log('[BsvWalletKMS] Full JWK:', JSON.stringify(publicKeyJWK, null, 2));

      // Return in the format expected by IKeyPair/IVCJsonLDKeyPair
      return {
        privateKey: privateKey.toWif(),
        publicKey: publicKey.toDER('hex') as string,
        publicKeyJWK: publicKeyJWK,
        keyType: 'EcdsaSecp256k1VerificationKey2019',
        suite: suite
      };
    } catch (error) {
      throw new Error(`Failed to create key pair: ${error.message}`);
    }
  }

  /**
   * Sign data using a public key JWK reference
   */
  async sign(
    suite: Suite,
    publicKeyJWK: IJWK,
    content: any
  ): Promise<string> {
    console.log('[BsvWalletKMS] sign called with:', {
      suite,
      publicKeyJWK,
      content,
      availableKeys: Array.from(this.keyStore.keys())
    });
    
    try {
      // Convert content to string if needed
      const message = typeof content === 'string' ? content : JSON.stringify(content);
      
      // Find the private key associated with this public key
      let privateKey: string | null = null;
      const publicKeyX = typeof publicKeyJWK.x === 'string' ? publicKeyJWK.x : '';
      
      for (const [keyId, stored] of this.keyStore.entries()) {
        if (stored.publicKey === publicKeyX || stored.keyId === keyId) {
          privateKey = stored.privateKey;
          break;
        }
      }
      
      if (!privateKey) {
        console.error('[BsvWalletKMS] Key not found for the given public key');
        throw new Error('Private key not found for the given public key');
      }

      // Convert the private key from WIF format
      const privKey = PrivateKey.fromWif(privateKey);
      
      // Sign the message
      const messageBuffer = Buffer.from(message, 'utf8');
      const signature = privKey.sign(Array.from(messageBuffer));
      
      return signature.toDER('hex') as string;
    } catch (error) {
      throw new Error(`Failed to sign message: ${error.message}`);
    }
  }

  /**
   * Verify a signature
   */
  async verifySignature(
    publicKeyJWK: IJWK,
    originalContent: string,
    signature: string
  ): Promise<boolean> {
    try {
      // Convert the public key from hex
      const publicKeyHex = typeof publicKeyJWK.x === 'string' ? publicKeyJWK.x : '';
      const pubKeyBuffer = Buffer.from(publicKeyHex, 'hex');
      const pubKey = PublicKey.fromDER(Array.from(pubKeyBuffer));
      
      // Convert message to buffer
      const messageBuffer = Buffer.from(originalContent, 'utf8');
      
      // Convert signature from hex
      const sigBuffer = Buffer.from(signature, 'hex');
      const sig = Signature.fromDER(Array.from(sigBuffer));
      
      // Verify the signature
      return pubKey.verify(Array.from(messageBuffer), sig);
    } catch (error) {
      console.error('Verification error:', error);
      return false;
    }
  }

  /**
   * Sign VC with full parameters
   */
  async signVC(
    suite: Suite,
    publicKeyJWK: IJWK,
    vc: any,
    did: string,
    verificationMethodId: string,
    purpose: Purpose
  ): Promise<VerifiableCredential> {
    const signature = await this.sign(suite, publicKeyJWK, vc);
    return {
      ...vc,
      proof: {
        type: 'EcdsaSecp256k1Signature2019',
        created: new Date().toISOString(),
        proofPurpose: purpose,
        verificationMethod: verificationMethodId,
        jws: signature
      }
    } as VerifiableCredential;
  }

  /**
   * Sign VC Presentation with proper parameters
   */
  async signVCPresentation(params: {
    publicKeyJWK: IJWK;
    presentationObject: any;
    did: string;
    verificationMethodId: string;
    purpose: Purpose;
  }): Promise<any> {
    const signature = await this.sign(Suite.ES256k, params.publicKeyJWK, params.presentationObject);
    return {
      ...params.presentationObject,
      proof: {
        type: 'EcdsaSecp256k1Signature2019',
        created: new Date().toISOString(),
        proofPurpose: params.purpose,
        verificationMethod: params.verificationMethodId,
        jws: signature
      }
    };
  }

  /**
   * Derive VC (not supported - returns original)
   */
  async deriveVC(params: {
    vc: VerifiableCredential;
    frame: any;
  }): Promise<VerifiableCredential> {
    // BSV doesn't support selective disclosure, return original VC
    return params.vc;
  }

  /**
   * Pack a message (basic implementation)
   */
  async pack(
    publicKeyJWK: IJWK,
    toHexPublicKeys: string[],
    contentToSign: string
  ): Promise<string> {
    // For BSV, we'll just sign and return the signature
    // In a real implementation, this would encrypt for recipients
    const signature = await this.sign(Suite.ES256k, publicKeyJWK, contentToSign);
    return JSON.stringify({
      content: contentToSign,
      signature,
      recipients: toHexPublicKeys
    });
  }

  /**
   * Pack v2 message
   */
  async packv2(
    publicKeyJWK: IJWK,
    senderVerificationMethodId: string,
    toHexPublicKeys: string[],
    message: IDIDCommMessage,
    packing: DIDCommMessagePacking
  ): Promise<IPackedDIDCommMessage> {
    const signature = await this.sign(Suite.ES256k, publicKeyJWK, message);
    // IPackedDIDCommMessage expects message as string
    const packedMessage = JSON.stringify({
      message,
      signature,
      sender: senderVerificationMethodId,
      recipients: toHexPublicKeys,
      packing
    });
    return {
      message: packedMessage
    };
  }

  /**
   * Pack DIDComm V2 message
   */
  async packDIDCommV2(params: {
    senderVerificationMethodId?: string;
    recipientVerificationMethodIds: string[];
    message: IDIDCommMessage;
    packing: string;
  }): Promise<{ packedMessage: any }> {
    // Simple implementation - in production this would do proper DIDComm packing
    return {
      packedMessage: {
        message: params.message,
        sender: params.senderVerificationMethodId,
        recipients: params.recipientVerificationMethodIds,
        packing: params.packing
      }
    };
  }

  /**
   * Unpack a message
   */
  async unpack(
    publicKeyJWK: IJWK,
    packedContent: string
  ): Promise<string> {
    try {
      const packed = JSON.parse(packedContent);
      // In a real implementation, this would decrypt and verify
      return packed.content || packedContent;
    } catch {
      return packedContent;
    }
  }

  /**
   * Unpack v2 message
   */
  async unpackv2(
    publicKeyJWK: IJWK,
    jwe: any
  ): Promise<string> {
    // Simple implementation - return the message
    return JSON.stringify(jwe);
  }

  /**
   * Unpack DIDComm V2 message
   */
  async unpackvDIDCommV2(
    receiptDID: string,
    packedMessage: any
  ): Promise<{
    message: DIDCommMessage;
    metaData: {
      packing: DIDCommMessagePacking;
    };
  }> {
    // Simple implementation - use string literal matching enum value
    const packing = packedMessage.packing || 'authcrypt';
    return {
      message: packedMessage.message || {} as DIDCommMessage,
      metaData: {
        packing: packing as DIDCommMessagePacking
      }
    };
  }

  /**
   * Export key as JWK
   */
  async export(publicKeyJWK: IJWK): Promise<any> {
    // Find the stored key
    const publicKeyX = typeof publicKeyJWK.x === 'string' ? publicKeyJWK.x : '';
    for (const [keyId, stored] of this.keyStore.entries()) {
      if (stored.publicKey === publicKeyX) {
        return {
          publicKeyHex: stored.publicKey,
          jwk: stored.jwk
        };
      }
    }
    throw new Error('Key not found for export');
  }

  /**
   * Import a key
   */
  async import(key: {
    publicKeyHex: string;
    secret: IKeyPair;
  }): Promise<void> {
    const keyId = key.secret.privateKey || `did:bsv:${key.publicKeyHex.substring(0, 16)}`;
    
    // Create JWK - IJWK only supports kty, crv, x, y
    const jwk: IJWK = {
      kty: 'EC',
      crv: 'secp256k1',
      x: key.publicKeyHex,
      y: '' // Required by interface but not used for secp256k1
    };
    
    // Store the key
    this.keyStore.set(keyId, {
      privateKey: key.secret.privateKey,
      publicKey: key.publicKeyHex,
      jwk,
      keyId
    });
  }

  /**
   * Get public keys by suite type
   */
  async getPublicKeysBySuiteType(suite: Suite): Promise<IJWK[]> {
    console.log('[BsvWalletKMS] getPublicKeysBySuiteType called with suite:', suite);
    console.log('[BsvWalletKMS] Current keyStore size:', this.keyStore.size);
    console.log('[BsvWalletKMS] Available keys:', Array.from(this.keyStore.keys()));
    
    const keys: IJWK[] = [];
    // For BSV, we only support ES256K
    if (suite === Suite.ES256k) {
      for (const stored of this.keyStore.values()) {
        keys.push(stored.jwk);
      }
    }
    
    console.log('[BsvWalletKMS] Returning keys:', keys.length);
    if (keys.length > 0) {
      console.log('[BsvWalletKMS] First key JWK:', JSON.stringify(keys[0], null, 2));
    }
    
    return keys;
  }

  /**
   * Get all public keys
   */
  async getAllPublicKeys(): Promise<IJWK[]> {
    console.log('[BsvWalletKMS] getAllPublicKeys called');
    console.log('[BsvWalletKMS] Current keyStore size:', this.keyStore.size);
    console.log('[BsvWalletKMS] Available keys:', Array.from(this.keyStore.keys()));
    
    const keys: IJWK[] = [];
    for (const stored of this.keyStore.values()) {
      keys.push(stored.jwk);
    }
    
    console.log('[BsvWalletKMS] Returning all keys:', keys.length);
    
    return keys;
  }
}
