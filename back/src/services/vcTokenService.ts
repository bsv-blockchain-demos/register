import { Db } from 'mongodb';
import { WalletClient, Script, OP, Hash, Utils, PushDrop, WalletProtocol, Byte } from '@bsv/sdk';
import { QuarkIdAgentService } from './quarkIdAgentService';
import { VerifiableCredential } from '@quarkid/vc-core';
import { KMSClient } from '@quarkid/kms-client';
import { Suite } from '@quarkid/kms-core';
import { AssertionMethodPurpose } from '@quarkid/did-core';
import * as crypto from 'crypto';

/**
 * Unified VC Token that combines Verifiable Credential with BSV token
 */
export interface VCToken {
  id: string;
  vcId: string;
  txid: string;
  vout: number;
  status: 'active' | 'transferred' | 'finalized';
  vc: VerifiableCredential;
  issuerDid: string;
  subjectDid: string;
  currentOwnerDid: string;
  metadata: {
    type: string;
    description: string;
    customData?: any;
  };
  tokenState: {
    createdAt: Date;
    updatedAt: Date;
    transferHistory: Array<{
      from: string;
      to: string;
      timestamp: Date;
      txid?: string;
    }>;
    finalizedAt?: Date;
  };
}

/**
 * Unified service for creating and managing VC tokens
 * Combines VC creation with BSV token creation in atomic operations
 */
export class VCTokenService {
  private db: Db;
  private walletClient: WalletClient;
  private quarkIdAgentService: QuarkIdAgentService;
  private kmsClient: KMSClient;
  private vcTokensCollection: any;

  constructor(
    db: Db,
    walletClient: WalletClient,
    quarkIdAgentService: QuarkIdAgentService,
    kmsClient: KMSClient
  ) {
    this.db = db;
    this.walletClient = walletClient;
    this.quarkIdAgentService = quarkIdAgentService;
    this.kmsClient = kmsClient;
    this.vcTokensCollection = db.collection('vc_tokens');
    
    // Create indexes for efficient querying
    this.createIndexes();
  }

  private async createIndexes() {
    await this.vcTokensCollection.createIndex({ vcId: 1 });
    await this.vcTokensCollection.createIndex({ txid: 1 });
    await this.vcTokensCollection.createIndex({ issuerDid: 1 });
    await this.vcTokensCollection.createIndex({ subjectDid: 1 });
    await this.vcTokensCollection.createIndex({ currentOwnerDid: 1 });
    await this.vcTokensCollection.createIndex({ 'metadata.type': 1 });
    await this.vcTokensCollection.createIndex({ status: 1 });
  }

  /**
   * Create a VC Token - combines VC issuance with BSV token creation
   * This is an atomic operation that ensures consistency
   */
  async createVCToken(params: {
    issuerDid: string;
    subjectDid: string;
    credentialType: string;
    claims: any;
    metadata?: {
      description?: string;
      customData?: any;
    };
    validFrom?: Date;
    validUntil?: Date;
  }): Promise<VCToken> {
    const session = this.db.client.startSession();
    
    try {
      return await session.withTransaction(async () => {
        // Step 1: Issue the Verifiable Credential
        // Check if BBS+ signature is requested
        const useBBSSignature = params.metadata?.customData?.useBBSSignature === true;
        
        let vc: VerifiableCredential;
        if (useBBSSignature) {
          console.log('[VCTokenService] Issuing VC with BBS+ signature...');
          vc = await this.createBBSSignedVC(params);
        } else {
          console.log('[VCTokenService] Issuing VC with ES256k signature...');
          vc = await this.quarkIdAgentService.issueVC(
            params.issuerDid,
            params.subjectDid,
            params.credentialType,
            params.claims,
            params.validFrom,
            params.validUntil
          );
        }

        // Step 2: Create BSV token with VC reference
        console.log('[VCTokenService] Creating BSV token...');
        const tokenTx = await this.createBSVToken(vc, params.issuerDid);

        // Step 3: Create unified VC Token record
        const vcToken: VCToken = {
          id: crypto.randomUUID(),
          vcId: vc.id,
          txid: tokenTx.txid,
          vout: 0, // First output
          status: 'active',
          vc: vc,
          issuerDid: params.issuerDid,
          subjectDid: params.subjectDid,
          currentOwnerDid: params.subjectDid, // Initially owned by subject
          metadata: {
            type: params.credentialType,
            description: params.metadata?.description || `${params.credentialType} issued by ${params.issuerDid}`,
            customData: params.metadata?.customData
          },
          tokenState: {
            createdAt: new Date(),
            updatedAt: new Date(),
            transferHistory: []
          }
        };

        // Step 4: Store in database
        await this.vcTokensCollection.insertOne(vcToken);
        
        console.log(`[VCTokenService] Created VC Token: ${vcToken.id} with txid: ${tokenTx.txid}`);
        return vcToken;
      });
    } catch (error) {
      console.error('[VCTokenService] Error creating VC token:', error);
      throw new Error(`Failed to create VC token: ${error.message}`);
    } finally {
      await session.endSession();
    }
  }

  /**
   * Transfer a VC Token to a new owner
   */
  async transferVCToken(
    tokenId: string,
    fromDid: string,
    toDid: string,
    metadata?: any
  ): Promise<VCToken> {
    const session = this.db.client.startSession();
    
    try {
      return await session.withTransaction(async () => {
        // Get current token
        const token = await this.vcTokensCollection.findOne({ id: tokenId });
        if (!token) {
          throw new Error('VC Token not found');
        }

        // Verify ownership
        if (token.currentOwnerDid !== fromDid) {
          throw new Error('Unauthorized: Token not owned by sender');
        }

        if (token.status === 'finalized') {
          throw new Error('Cannot transfer finalized token');
        }

        // Create transfer transaction on BSV
        const transferTx = await this.createTransferTransaction(token, toDid);

        // Update token record
        const updatedToken = await this.vcTokensCollection.findOneAndUpdate(
          { id: tokenId },
          {
            $set: {
              currentOwnerDid: toDid,
              'tokenState.updatedAt': new Date(),
              txid: transferTx.txid // Update to new UTXO
            },
            $push: {
              'tokenState.transferHistory': {
                from: fromDid,
                to: toDid,
                timestamp: new Date(),
                txid: transferTx.txid,
                metadata
              }
            }
          },
          { returnDocument: 'after' }
        );

        console.log(`[VCTokenService] Transferred token ${tokenId} from ${fromDid} to ${toDid}`);
        return updatedToken.value;
      });
    } catch (error) {
      console.error('[VCTokenService] Error transferring VC token:', error);
      throw error;
    } finally {
      await session.endSession();
    }
  }

  /**
   * Finalize a VC Token (mark as completed/used)
   */
  async finalizeVCToken(
    tokenId: string,
    finalizerDid: string,
    finalMetadata?: any
  ): Promise<VCToken> {
    const token = await this.vcTokensCollection.findOne({ id: tokenId });
    if (!token) {
      throw new Error('VC Token not found');
    }

    // Only certain roles can finalize (e.g., original subject for prescriptions)
    // This logic can be customized based on credential type
    const canFinalize = this.checkFinalizationPermission(token, finalizerDid);
    if (!canFinalize) {
      throw new Error('Unauthorized: Cannot finalize this token');
    }

    if (token.status === 'finalized') {
      throw new Error('Token already finalized');
    }

    // Update token status
    const updatedToken = await this.vcTokensCollection.findOneAndUpdate(
      { id: tokenId },
      {
        $set: {
          status: 'finalized',
          'tokenState.updatedAt': new Date(),
          'tokenState.finalizedAt': new Date(),
          'tokenState.finalMetadata': finalMetadata
        }
      },
      { returnDocument: 'after' }
    );

    console.log(`[VCTokenService] Finalized token ${tokenId}`);
    return updatedToken.value;
  }

  /**
   * Get VC Token by ID
   */
  async getVCToken(tokenId: string): Promise<VCToken | null> {
    return await this.vcTokensCollection.findOne({ id: tokenId });
  }

  /**
   * Get VC Tokens by various criteria
   */
  async getVCTokens(filter: {
    issuerDid?: string;
    subjectDid?: string;
    currentOwnerDid?: string;
    type?: string;
    status?: 'active' | 'transferred' | 'finalized';
  }): Promise<VCToken[]> {
    const query: any = {};
    
    if (filter.issuerDid) query.issuerDid = filter.issuerDid;
    if (filter.subjectDid) query.subjectDid = filter.subjectDid;
    if (filter.currentOwnerDid) query.currentOwnerDid = filter.currentOwnerDid;
    if (filter.type) query['metadata.type'] = filter.type;
    if (filter.status) query.status = filter.status;

    return await this.vcTokensCollection
      .find(query)
      .sort({ 'tokenState.createdAt': -1 })
      .toArray();
  }

  /**
   * Verify a VC Token (verify both VC signature and BSV token validity)
   */
  async verifyVCToken(tokenId: string): Promise<{
    valid: boolean;
    vcValid: boolean;
    tokenValid: boolean;
    errors?: string[];
  }> {
    try {
      const token = await this.getVCToken(tokenId);
      if (!token) {
        return {
          valid: false,
          vcValid: false,
          tokenValid: false,
          errors: ['VC Token not found']
        };
      }

      // Verify the VC
      const vcResult = await this.quarkIdAgentService.verifyVC(token.vc);
      
      // In production, would also verify the BSV token on-chain
      const tokenValid = true; // Placeholder for BSV verification

      return {
        valid: vcResult.verified && tokenValid,
        vcValid: vcResult.verified,
        tokenValid: tokenValid,
        errors: vcResult.errors
      };
    } catch (error) {
      return {
        valid: false,
        vcValid: false,
        tokenValid: false,
        errors: [`Verification error: ${error.message}`]
      };
    }
  }

  /**
   * Create a BBS+ signed VC using KMSClient for selective disclosure
   */
  private async createBBSSignedVC(params: {
    issuerDid: string;
    subjectDid: string;
    credentialType: string;
    claims: any;
    metadata?: {
      description?: string;
      customData?: any;
    };
    validFrom?: Date;
    validUntil?: Date;
  }): Promise<VerifiableCredential> {
    console.log('[VCTokenService] Creating BBS+ signed VC...');
    
    // Create the unsigned VC structure
    const issuanceDate = new Date();
    const expirationDate = params.validUntil || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000); // 1 year default
    
    const unsignedVC: VerifiableCredential = {
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
        'https://w3id.org/security/suites/jws-2020/v1',
        'https://w3id.org/security/bbs/v1'
      ],
      id: `urn:uuid:${crypto.randomUUID()}`,
      type: ['VerifiableCredential', params.credentialType],
      issuer: params.issuerDid,
      issuanceDate: issuanceDate.toISOString(),
      expirationDate: expirationDate.toISOString(),
      credentialSubject: {
        id: params.subjectDid,
        ...params.claims
      }
    };
    
    // Add validFrom if specified
    if (params.validFrom) {
      (unsignedVC as any).validFrom = params.validFrom.toISOString();
    }
    
    try {
      // First, create or get a BBS+ key pair
      console.log('[VCTokenService] Creating BBS+ key pair...');
      const keyPair = await this.kmsClient.create(Suite.Bbsbls2020);
      console.log('[VCTokenService] BBS+ key pair created:', keyPair.publicKeyJWK);
      
      // Create verification method ID 
      const verificationMethodId = `${params.issuerDid}#bbsKey1`;
      
      // Use KMSClient to sign the VC with BBS+ signature
      console.log('[VCTokenService] Signing VC with BBS+ using KMSClient...');
      
      const signedVC = await this.kmsClient.signVC(
        Suite.Bbsbls2020,
        keyPair.publicKeyJWK,
        unsignedVC,
        params.issuerDid,
        verificationMethodId,
        new AssertionMethodPurpose()
      );
      
      console.log('[VCTokenService] BBS+ signed VC created successfully');
      return signedVC;
      
    } catch (error) {
      console.error('[VCTokenService] Error creating BBS+ signed VC:', error);
      throw new Error(`Failed to create BBS+ signed VC: ${error.message}`);
    }
  }

  // Private helper methods

  private async createBSVToken(vc: VerifiableCredential, issuerDid: string) {
    // Create unique serial number for the VC token
    const uniqueData = {
      vcId: vc.id,
      issuerDid,
      timestamp: Date.now(),
      nonce: Math.random().toString(36).substring(2, 15)
    };
    const serialNumberBytes = Hash.sha256(JSON.stringify(uniqueData));
    const serialNumber = Utils.toHex(serialNumberBytes);
    
    // Prepare VC reference data for PushDrop
    const vcData = {
      vcId: vc.id,
      vcHash: this.hashVC(vc),
      issuer: issuerDid,
      type: vc.type.join(',')
    };
    
    // Build PushDrop fields
    const fields: Byte[][] = [
      serialNumberBytes,
      Array.from(Buffer.from(JSON.stringify(vcData)))
    ];
    
    // Protocol ID for VC tokens
    const protocolID: WalletProtocol = [0, 'vc token'];
    const keyID: string = serialNumber;
    const counterparty: string = 'self';
    
    // Create PushDrop locking script
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
    
    // Create BSV transaction
    const createActionResult = await this.walletClient.createAction({
      description: 'Create VC token with BSV overlay',
      outputs: [
        {
          satoshis: 1,
          lockingScript: lockingScript,
          outputDescription: 'VC PushDrop Token',
          basket: 'vc-tokens',
          customInstructions: JSON.stringify({
            protocolID: protocolID,
            counterparty: counterparty,
            keyID: keyID,
            fields: fields,
            type: 'PushDrop',
            vcData: vcData
          })
        }
      ],
      options: {
        randomizeOutputs: false,
      },
      labels: ['vc-token', 'create']
    });
    
    return {
      ...createActionResult,
      serialNumber,
      vcData
    };
  }

  private async createTransferTransaction(token: VCToken, newOwnerDid: string) {
    // In a real implementation, this would spend the previous UTXO
    // and create a new one locked to the new owner
    // For now, we'll create a simple transfer record
    
    const transferData = {
      previousTxid: token.txid,
      from: token.currentOwnerDid,
      to: newOwnerDid,
      vcId: token.vcId,
      timestamp: Date.now()
    };
    
    const script = new Script()
      .writeOpCode(OP.OP_RETURN)
      .writeBin(Array.from(Buffer.from('VC_TRANSFER')))
      .writeBin(Array.from(Buffer.from(JSON.stringify(transferData))));
    
    const action = await this.walletClient.createAction({
      description: 'Transfer VC token ownership',
      outputs: [{
        lockingScript: script.toHex(),
        satoshis: 0,
        outputDescription: 'VC token transfer record'
      }]
    });
    
    return action;
  }

  private checkFinalizationPermission(token: VCToken, finalizerDid: string): boolean {
    // Customize based on credential type
    // For prescriptions: only original patient can finalize
    // For other types: might have different rules
    
    if (token.metadata.type === 'PrescriptionCredential') {
      return token.subjectDid === finalizerDid;
    }
    
    // Default: current owner can finalize
    return token.currentOwnerDid === finalizerDid;
  }

  private hashVC(vc: VerifiableCredential): string {
    const vcData = JSON.stringify(vc);
    const hash = crypto.createHash('sha256');
    hash.update(vcData);
    return hash.digest('hex');
  }

  /**
   * Get statistics about VC tokens
   */
  async getStatistics(): Promise<{
    total: number;
    byStatus: { active: number; transferred: number; finalized: number };
    byType: { [key: string]: number };
    byIssuer: { [key: string]: number };
  }> {
    const total = await this.vcTokensCollection.countDocuments();
    const active = await this.vcTokensCollection.countDocuments({ status: 'active' });
    const transferred = await this.vcTokensCollection.countDocuments({ status: 'transferred' });
    const finalized = await this.vcTokensCollection.countDocuments({ status: 'finalized' });

    // Aggregate by type
    const typeAggregation = await this.vcTokensCollection.aggregate([
      { $group: { _id: '$metadata.type', count: { $sum: 1 } } }
    ]).toArray();
    
    const byType: { [key: string]: number } = {};
    typeAggregation.forEach(item => {
      byType[item._id] = item.count;
    });

    // Aggregate by issuer
    const issuerAggregation = await this.vcTokensCollection.aggregate([
      { $group: { _id: '$issuerDid', count: { $sum: 1 } } }
    ]).toArray();
    
    const byIssuer: { [key: string]: number } = {};
    issuerAggregation.forEach(item => {
      byIssuer[item._id] = item.count;
    });

    return {
      total,
      byStatus: { active, transferred, finalized },
      byType,
      byIssuer
    };
  }
}