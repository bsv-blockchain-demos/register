import { 
  WalletClient, 
  SatoshisPerKilobyte
} from '@bsv/sdk';
import { Agent } from '@quarkid/agent';
import { VerifiableCredential } from '@quarkid/vc-core';
import { BsvOverlayDidRegistryService } from '../lib/BsvOverlayDidRegistryService';

/**
 * Configuration interface for the BSV VC Service
 */
export interface BsvVcServiceConfig {
  walletClient: WalletClient;
  topic: string;
  overlayProviderUrl: string;
  feePerKb?: number;
  agent?: Agent;
}

/**
 * VC Transaction types for BSV overlay
 */
export enum VcTransactionType {
  ISSUE = 'ISSUE',
  REVOKE = 'REVOKE',
  SUSPEND = 'SUSPEND',
  REACTIVATE = 'REACTIVATE'
}

/**
 * VC Operation payload structure
 */
export interface VcOperationPayload {
  type: VcTransactionType;
  vcId: string;
  vcDocument?: VerifiableCredential;
  issuerDid: string;
  subjectDid: string;
  timestamp: number;
  signature?: string;
}

/**
 * VC Creation request
 */
export interface CreateVcRequest {
  vcDocument: VerifiableCredential;
  issuerDid: string;
  subjectDid: string;
  controllerPublicKeyHex: string;
}

/**
 * VC Creation response
 */
export interface CreateVcResponse {
  vcId: string;
  txid: string;
  status: 'issued';
  vcDocument: VerifiableCredential;
}

/**
 * VC Resolution response
 */
export interface ResolveVcResponse {
  vcId: string;
  vcDocument: VerifiableCredential;
  status: 'active' | 'revoked' | 'suspended';
  issuerDid: string;
  subjectDid: string;
  issuanceDate: string;
  lastUpdated: string;
}

/**
 * BSV VC Service - Manages Verifiable Credentials on BSV overlay
 * 
 * This service provides functionality for:
 * - Issuing VCs as push-drop tokens on BSV
 * - Managing VC lifecycle (issue, revoke, suspend, reactivate)
 * - Resolving VCs from the blockchain
 * - Integration with Extrimian Agent for cryptographic operations
 */
export class BsvVcService {
  private bsvOverlayService: BsvOverlayDidRegistryService;
  private topic: string;
  private agent?: Agent;

  constructor(config: BsvVcServiceConfig) {
    if (!config.walletClient) {
      throw new Error('WalletClient is required for BSV VC operations');
    }

    if (!config.topic || typeof config.topic !== 'string') {
      throw new Error('Topic is required and must be a non-empty string');
    }

    if (!config.overlayProviderUrl || typeof config.overlayProviderUrl !== 'string') {
      throw new Error('Overlay node endpoint is required and must be a valid URL');
    }

    this.topic = config.topic;
    this.agent = config.agent;

    // Initialize BSV overlay service for VC operations
    this.bsvOverlayService = new BsvOverlayDidRegistryService({
      signer: this.createSignerFunction(config.walletClient),
      utxoProvider: this.createUtxoProviderFunction(config.walletClient),
      changeAddressProvider: this.createChangeAddressProvider(config.walletClient),
      overlayNodeEndpoint: config.overlayProviderUrl,
      topic: config.topic,
      feeModel: new SatoshisPerKilobyte(config.feePerKb || 50)
    });

    console.log(`[BsvVcService] Initialized with topic: ${config.topic}`);
  }

  /**
   * Issue a new Verifiable Credential on BSV
   */
  async issueVC(request: CreateVcRequest): Promise<CreateVcResponse> {
    console.log(`[BsvVcService] Issuing VC for subject: ${request.subjectDid}`);
    
    try {
      // Create VC operation payload as DID document format for BSV overlay
      const vcId = `vc:bsv:${this.topic}:${Date.now()}`;
      const vcAsDidDocument = {
        '@context': ['https://www.w3.org/ns/did/v1', 'https://w3id.org/vc/v1'],
        id: vcId,
        vcData: {
          type: VcTransactionType.ISSUE,
          vcDocument: request.vcDocument,
          issuerDid: request.issuerDid,
          subjectDid: request.subjectDid,  
          timestamp: Date.now()
        }
      };

      // Use BSV overlay service to create the VC transaction
      const result = await this.bsvOverlayService.createDID({
        didDocument: vcAsDidDocument,
        controllerPublicKeyHex: request.controllerPublicKeyHex
      });
      
      console.log(`[BsvVcService] VC issued successfully. VC ID: ${vcId}, TXID: ${result.metadata.txid}`);
      
      return {
        vcId,
        txid: result.metadata.txid,
        status: 'issued',
        vcDocument: request.vcDocument
      };
    } catch (error) {
      console.error(`[BsvVcService] Error issuing VC:`, error);
      throw error;
    }
  }

  /**
   * Revoke a Verifiable Credential
   */
  async revokeVC(vcId: string, issuerDid: string, controllerPublicKeyHex: string): Promise<string> {
    console.log(`[BsvVcService] Revoking VC: ${vcId}`);
    
    try {
      // Create revocation payload as DID document
      const revocationDidDocument = {
        '@context': ['https://www.w3.org/ns/did/v1', 'https://w3id.org/vc/v1'],
        id: `${vcId}-revocation-${Date.now()}`,
        vcData: {
          type: VcTransactionType.REVOKE,
          vcId,
          issuerDid,
          timestamp: Date.now()
        }
      };

      const result = await this.bsvOverlayService.createDID({
        didDocument: revocationDidDocument,
        controllerPublicKeyHex
      });
      
      console.log(`[BsvVcService] VC revoked successfully. Revocation TXID: ${result.metadata.txid}`);
      return result.metadata.txid;
    } catch (error) {
      console.error(`[BsvVcService] Error revoking VC:`, error);
      throw error;
    }
  }

  /**
   * Resolve a Verifiable Credential from BSV
   */
  async resolveVC(vcId: string): Promise<ResolveVcResponse> {
    console.log(`[BsvVcService] Resolving VC: ${vcId}`);
    
    try {
      // Use BSV overlay service to resolve the VC
      const result = await this.bsvOverlayService.resolveDID(vcId);
      
      if (!result.didDocument || !result.didDocument.vcData) {
        throw new Error(`VC document not found for: ${vcId}`);
      }

      const vcData = result.didDocument.vcData;
      
      return {
        vcId: vcData.vcDocument?.id || vcId,
        vcDocument: vcData.vcDocument,
        status: 'active', // TODO: Check for revocation transactions
        issuerDid: vcData.issuerDid,
        subjectDid: vcData.subjectDid,
        issuanceDate: new Date(vcData.timestamp).toISOString(),
        lastUpdated: new Date(vcData.timestamp).toISOString()
      };
    } catch (error) {
      console.error(`[BsvVcService] Error resolving VC ${vcId}:`, error);
      throw error;
    }
  }

  /**
   * Get all VCs for a subject DID
   */
  async getVCsForSubject(subjectDid: string): Promise<ResolveVcResponse[]> {
    console.log(`[BsvVcService] Getting VCs for subject: ${subjectDid}`);
    
    try {
      // This would require enhanced overlay service functionality
      // For now, return empty array with note
      console.log(`[BsvVcService] Subject VC lookup requires enhanced overlay functionality`);
      return [];
    } catch (error) {
      console.error(`[BsvVcService] Error getting VCs for subject ${subjectDid}:`, error);
      throw error;
    }
  }

  /**
   * Get all VCs issued by an issuer DID
   */
  async getVCsByIssuer(issuerDid: string): Promise<ResolveVcResponse[]> {
    console.log(`[BsvVcService] Getting VCs by issuer: ${issuerDid}`);
    
    try {
      // This would require enhanced overlay service functionality
      // For now, return empty array with note
      console.log(`[BsvVcService] Issuer VC lookup requires enhanced overlay functionality`);
      return [];
    } catch (error) {
      console.error(`[BsvVcService] Error getting VCs by issuer ${issuerDid}:`, error);
      throw error;
    }
  }

  /**
   * Create signer function for BSV overlay service
   */
  private createSignerFunction(walletClient: WalletClient) {
    return async (
      tx: any,
      inputsToSign: Array<{
        inputIndex: number;
        publicKeyHex: string;
        sighashType?: number;
      }>
    ) => {
      // Implementation would depend on wallet client signing interface
      console.log(`[BsvVcService] Signing transaction with ${inputsToSign.length} inputs`);
      for (const inputInfo of inputsToSign) {
        console.log(`[BsvVcService] Signing input ${inputInfo.inputIndex}`);
      }
      return tx; // Return signed transaction
    };
  }

  /**
   * Create UTXO provider function for BSV overlay service
   */
  private createUtxoProviderFunction(walletClient: WalletClient) {
    return async (satoshisNeeded: number) => {
      console.log(`[BsvVcService] Providing UTXOs for ${satoshisNeeded} satoshis`);
      return [];
    };
  }

  /**
   * Create change address provider function for BSV overlay service
   */
  private createChangeAddressProvider(walletClient: WalletClient) {
    return async () => {
      console.log(`[BsvVcService] Providing change address`);
      return 'change-address-placeholder';
    };
  }
}
