// src/services/didService.ts
import type { BackendSubmitPayload, CreateDidResponse, DidResolutionResult } from '../types';

const BACKEND_URL = 'http://localhost:8080';
const DID_TOPIC_NAME = 'tm_qdid';
const DID_LOOKUP_SERVICE_ID = 'ls_qdid';

class DidService {
  async createDid(submitPayload: BackendSubmitPayload): Promise<CreateDidResponse> {
    const response = await fetch(`${BACKEND_URL}/topics/${DID_TOPIC_NAME}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(submitPayload),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('Backend error response:', errorData);
      throw new Error(`Failed to create DID: ${response.status} ${response.statusText}. ${errorData}`);
    }
    return response.json() as Promise<CreateDidResponse>;
  }

  async resolveDid(did: string): Promise<DidResolutionResult> {
    // The DID itself is the key for the lookup service
    const response = await fetch(`${BACKEND_URL}/lookup/${DID_LOOKUP_SERVICE_ID}/${encodeURIComponent(did)}`);

    if (!response.ok) {
      const errorData = await response.text();
      console.error('Backend error response:', errorData);
      throw new Error(`Failed to resolve DID: ${response.status} ${response.statusText}. ${errorData}`);
    }
    return response.json() as Promise<DidResolutionResult>;
  }
}

export const didService = new DidService();
