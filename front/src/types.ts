// src/types.ts

export interface CreateDidPayload {
  operation: 'CREATE_DID';
  controllerPublicKeyHex: string;
  didDocument?: { // Optional, can be minimal or handled by backend
    '@context'?: string | string[];
    [key: string]: any;
  };
}

export interface BackendSubmitPayload {
  transaction: string; // Raw transaction hex
  payload: CreateDidPayload; // Or other payload types later
}

export interface DidResolutionResult {
  didDocument: any | null;
  didDocumentMetadata: any;
  didResolutionMetadata: any;
}

export interface CreateDidResponse {
  // Define based on what your backend's /topics endpoint returns
  // Typically it might return information about the accepted UTXO
  outputsAccepted: Array<{
    txid: string;
    vout: number;
    script: string;
    satoshis: number;
    topic: string;
  }>;
  [key: string]: any;
}
