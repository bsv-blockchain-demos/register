import {
  Transaction,
  P2PKH,
  Hash,
  PublicKey,
  PrivateKey,
  TransactionSignature,
  LockingScript,
  UnlockingScript,
  TransactionInput,
  SatoshisPerKilobyte
} from '@bsv/sdk';

// Types and interfaces
export interface UTXO {
  txid: string;
  vout: number;
  scriptPubKey: string;
  satoshis: number;
  sourceTransactionHex: string;
  publicKeyHex?: string;
}

export type BsvSignerFunction = (
  transaction: Transaction,
  inputsToSign: Array<{
    inputIndex: number;
    publicKeyHex: string;
    sighashType?: number;
  }>
) => Promise<Transaction>;

export type UtxoProviderFunction = (
  amountNeeded: number,
  specificOutpoint?: { txid: string; vout: number }
) => Promise<UTXO[]>;

export type ChangeAddressProviderFunction = () => Promise<string>;

export interface ResolveDidSuccessResponse {
  didDocument: any;
  metadata: {
    method: {
      published: boolean;
      network?: string;
      txid?: string;
      vout?: number;
      blockHeight?: number;
      timestamp?: string;
    };
    resolver?: any;
  };
}

export interface BsvOverlayDidRegistryConfig {
  signer: BsvSignerFunction;
  utxoProvider: UtxoProviderFunction;
  changeAddressProvider: ChangeAddressProviderFunction;
  overlayNodeEndpoint: string;
  topic: string;
  feeModel?: SatoshisPerKilobyte;
  fetchImplementation?: (url: string, init?: any) => Promise<any>;
}

export interface CreateDidRequest {
  didDocument: any;
  controllerPublicKeyHex: string;
  feePerKb?: number;
}

export interface UpdateDidRequest {
  didToUpdate: string;
  currentBrc48TxHex: string;
  currentBrc48Vout: number;
  currentBrc48Satoshis: number;
  currentControllerPrivateKeyHex: string;
  newDidDocument: any;
  newControllerPublicKeyHex: string;
  feePerKb?: number;
}

export interface UpdateDidResponse {
  did: string;
  didDocument: any;
  transaction: Transaction;
  metadata: {
    txid: string;
    vout: number;
    protocol: string;
    operation: string;
    previousTxid: string;
    previousVout: number;
  };
}

export interface CreateDidResponse {
  did: string;
  longFormDid?: string;
  didDocument: any;
  transaction: Transaction;
  metadata: {
    txid: string;
    vout: number;
    protocol: string;
    operation: string;
  };
}

// Constants
const QKDID_PROTOCOL_MARKER = 'QKDID';
const OP_CREATE = 'CREATE';
const OP_UPDATE = 'UPDATE';

export class BsvOverlayDidRegistryService {
  private config: BsvOverlayDidRegistryConfig;
  private fetchImplementation: (url: string, init?: any) => Promise<any>;

  constructor(config: BsvOverlayDidRegistryConfig) {
    this.config = config;
    this.fetchImplementation = config.fetchImplementation || fetch;
  }

  async createDID(request: CreateDidRequest): Promise<CreateDidResponse> {
    console.log('Creating DID with BSV Overlay method...');
    
    // Generate a new key pair for the DID identifier
    const identityKey = request.didDocument.identityKey;
    
    // Create transaction
    const tx = new Transaction();
    
    // Create OP_RETURN output with DID document
    const didDocumentString = JSON.stringify(request.didDocument);
    
    // Create OP_RETURN script using BSV SDK methods
    const opReturnScript = new LockingScript();
    opReturnScript.writeOpCode(0); // OP_FALSE
    opReturnScript.writeOpCode(106); // OP_RETURN
    opReturnScript.writeBin(Array.from(Buffer.from(QKDID_PROTOCOL_MARKER, 'utf8')));
    opReturnScript.writeBin(Array.from(Buffer.from(OP_CREATE, 'utf8')));
    opReturnScript.writeBin(Array.from(Buffer.from(this.config.topic, 'utf8')));
    opReturnScript.writeBin(Array.from(Buffer.from(didDocumentString, 'utf8')));
    
    tx.addOutput({
      lockingScript: opReturnScript,
      satoshis: 0
    });
    
    // Create BRC-48 identifier output
    const identifierScript = new P2PKH().lock(identifierPublicKey.toAddress().toString());
    const brc48OutputIndex = tx.outputs.length; // Get index before adding
    tx.addOutput({
      lockingScript: identifierScript,
      satoshis: 1000 // Minimum dust amount
    });
    
    // Add funding inputs
    const totalOutputSatoshis = 1000; // Just the BRC-48 output
    const estimatedFee = 200; // Basic fee estimation
    const totalNeeded = totalOutputSatoshis + estimatedFee;
    
    const utxos = await this.config.utxoProvider(totalNeeded);
    if (utxos.length === 0) {
      throw new Error('No UTXOs available for funding the transaction');
    }
    
    let totalInputSatoshis = 0;
    const inputsToSign: Array<{
      inputIndex: number;
      publicKeyHex: string;
      sighashType?: number;
    }> = [];
    
    for (const utxo of utxos) {
      const inputTx = Transaction.fromHex(utxo.sourceTransactionHex);
      tx.addInput({
        sourceTransaction: inputTx,
        sourceOutputIndex: utxo.vout
      });
      
      totalInputSatoshis += utxo.satoshis;
      
      if (utxo.publicKeyHex) {
        inputsToSign.push({
          inputIndex: tx.inputs.length - 1,
          publicKeyHex: utxo.publicKeyHex
        });
      }
      
      if (totalInputSatoshis >= totalNeeded) {
        break;
      }
    }
    
    // Add change output if needed
    const change = totalInputSatoshis - totalNeeded;
    if (change > 546) { // Dust threshold
      const changeScript = await this.config.changeAddressProvider();
      tx.addOutput({
        lockingScript: LockingScript.fromHex(changeScript),
        satoshis: change
      });
    }
    
    // Sign the transaction
    const signedTx = await this.config.signer(tx, inputsToSign);
    
    // Broadcast transaction (simplified - in real implementation would use overlay node)
    console.log('Transaction created successfully');
    
    // Generate DID
    const txid = signedTx.id('hex');
    const did = `did:bsv:${this.config.topic}:${txid}:${brc48OutputIndex}`;
    
    return {
      did,
      didDocument: request.didDocument,
      transaction: signedTx,
      metadata: {
        txid,
        vout: brc48OutputIndex,
        protocol: QKDID_PROTOCOL_MARKER,
        operation: OP_CREATE
      }
    };
  }

  async updateDID(request: UpdateDidRequest): Promise<UpdateDidResponse> {
    console.log('Updating DID with BSV Overlay method...');
    
    // Parse current DID
    const parts = request.didToUpdate.split(':');
    if (parts.length !== 5) {
      throw new Error('Invalid DID format');
    }
    
    const previousTxid = parts[3];
    const previousVout = parseInt(parts[4], 10);
    
    // Create new transaction similar to create
    const tx = new Transaction();
    
    // Add previous BRC-48 output as input
    const currentBrc48Input = {
      sourceTransaction: Transaction.fromHex(request.currentBrc48TxHex),
      sourceOutputIndex: request.currentBrc48Vout
    };
    
    tx.addInput(currentBrc48Input);
    
    // Create OP_RETURN output with updated DID document
    const didDocumentString = JSON.stringify(request.newDidDocument);
    
    // Create OP_RETURN script using BSV SDK methods
    const opReturnScript = new LockingScript();
    opReturnScript.writeOpCode(0); // OP_FALSE
    opReturnScript.writeOpCode(106); // OP_RETURN
    opReturnScript.writeBin(Array.from(Buffer.from(QKDID_PROTOCOL_MARKER, 'utf8')));
    opReturnScript.writeBin(Array.from(Buffer.from(OP_UPDATE, 'utf8')));
    opReturnScript.writeBin(Array.from(Buffer.from(this.config.topic, 'utf8')));
    opReturnScript.writeBin(Array.from(Buffer.from(previousTxid, 'utf8')));
    opReturnScript.writeBin(Array.from(Buffer.from(previousVout.toString(), 'utf8')));
    opReturnScript.writeBin(Array.from(Buffer.from(didDocumentString, 'utf8')));
    
    tx.addOutput({
      lockingScript: opReturnScript,
      satoshis: 0
    });
    
    // Create new BRC-48 identifier output
    const newIdentifierPublicKey = PublicKey.fromString(request.newControllerPublicKeyHex);
    const identifierScript = new P2PKH().lock(newIdentifierPublicKey.toAddress().toString());
    const brc48OutputIndex = tx.outputs.length; // Get index before adding
    tx.addOutput({
      lockingScript: identifierScript,
      satoshis: 1000
    });
    
    // Sign transaction (simplified)
    const inputsToSign = [{
      inputIndex: 0,
      publicKeyHex: PrivateKey.fromString(request.currentControllerPrivateKeyHex).toPublicKey().toString()
    }];
    
    const signedTx = await this.config.signer(tx, inputsToSign);
    
    const txid = signedTx.id('hex');
    const did = `did:bsv:${this.config.topic}:${txid}:${brc48OutputIndex}`;
    
    return {
      did,
      didDocument: request.newDidDocument,
      transaction: signedTx,
      metadata: {
        txid,
        vout: brc48OutputIndex,
        protocol: QKDID_PROTOCOL_MARKER,
        operation: OP_UPDATE,
        previousTxid,
        previousVout
      }
    };
  }

  async resolveDID(did: string): Promise<ResolveDidSuccessResponse> {
    const parts = did.split(':');
    if (parts.length !== 5 || parts[0] !== 'did' || parts[1] !== 'bsv') {
      throw new Error('Invalid DID string format');
    }
    
    const didTopic = parts[2];
    const txid = parts[3];
    const vout = parseInt(parts[4], 10);
    
    if (isNaN(vout)) {
      throw new Error('Invalid vout in DID string');
    }
    
    const resolutionUrl = `${this.config.overlayNodeEndpoint}/resolve/${didTopic}/${txid}/${vout}`;
    
    try {
      const response = await this.fetchImplementation(resolutionUrl, {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to resolve DID: ${response.status}`);
      }
      
      const resolvedData = await response.json();
      return resolvedData;
    } catch (error: any) {
      throw new Error(`Error resolving DID: ${error.message}`);
    }
  }
}

// Re-export SatoshisPerKilobyte from @bsv/sdk
export { SatoshisPerKilobyte } from '@bsv/sdk';

// Additional request types for API compatibility  
export interface CreateDidRequest {
  didDocument: any;
}

// Simplified response types for routes
export interface CreateDidApiResponse {
  txid: string;
  did: string;
}

export interface UpdateDidApiResponse {
  txid: string;
  did: string;
}

export interface ResolveDidResponse {
  didDocument: any;
}
