import { WalletClient, Byte, Utils } from '@bsv/sdk';
import { Db } from 'mongodb';
import * as crypto from 'crypto';
import { appConfig } from '../config/AppConfig';

/**
 * DWN Message interface for secure VC transmission
 */
export interface DWNMessage {
  id: string;
  type: 'prescription' | 'dispensation' | 'confirmation';
  from: string; // Sender DID
  to: string;   // Recipient DID
  subject: string;
  encryptedPayload: string;
  timestamp: Date;
  threadId?: string; // For grouping related messages
  metadata: {
    prescriptionId?: string;
    vcType?: string;
    urgent?: boolean;
  };
  read?: boolean;
  readAt?: Date;
}

/**
 * DWN Storage Service using the same storage backend as BSV wallet
 * 
 * This service stores DWN messages in the wallet storage (e.g., https://store-us-1.bsvb.tech)
 * instead of using local MongoDB, providing unified storage for all user data.
 */
export class DWNStorageService {
  private walletClient: WalletClient;

  constructor(walletClient: WalletClient) {
    this.walletClient = walletClient;
  }

  /**
   * Store a DWN message in wallet storage
   */
  async storeMessage(message: DWNMessage): Promise<void> {
    try {
      console.log('[DWNStorageService] Storing message:', message.id);

      // Serialize the message
      const messageData = JSON.stringify(message);
      const messageBytes = Utils.toArray(messageData, 'utf8') as Byte[];

      // Create a transaction to store the DWN message
      const result = await this.walletClient.createAction({
        description: `Store DWN message: ${message.type}`,
        outputs: [{
          satoshis: 1,
          lockingScript: this.createDWNLockingScript(messageBytes),
          outputDescription: `DWN Message: ${message.type}`,
          basket: 'dwn-messages',
          customInstructions: JSON.stringify({
            type: 'dwn-message',
            messageId: message.id,
            from: message.from,
            to: message.to,
            messageType: message.type,
            threadId: message.threadId,
            timestamp: message.timestamp.toISOString()
          })
        }],
        labels: ['dwn', 'message', message.type]
      });

      console.log('[DWNStorageService] Message stored with txid:', result.txid);
    } catch (error) {
      console.error('[DWNStorageService] Error storing message:', error);
      throw new Error(`Failed to store DWN message: ${error.message}`);
    }
  }

  /**
   * Retrieve DWN messages for a specific DID
   */
  async getMessages(
    recipientDid: string,
    filters: {
      type?: string;
      threadId?: string;
      unreadOnly?: boolean;
      limit?: number;
    } = {}
  ): Promise<DWNMessage[]> {
    try {
      console.log('[DWNStorageService] Retrieving messages for DID:', recipientDid);

      // Get all DWN message outputs from wallet storage
      const outputs = await this.walletClient.getUTXOs({
        basket: 'dwn-messages'
      });

      const messages: DWNMessage[] = [];

      for (const output of outputs) {
        try {
          // Parse custom instructions to check if this message is for the recipient
          const customInstructions = JSON.parse(output.customInstructions || '{}');
          
          if (customInstructions.type !== 'dwn-message') continue;
          if (customInstructions.to !== recipientDid) continue;

          // Apply filters
          if (filters.type && customInstructions.messageType !== filters.type) continue;
          if (filters.threadId && customInstructions.threadId !== filters.threadId) continue;

          // Decode the message from the locking script
          const messageData = this.extractDWNMessage(output.lockingScript);
          if (messageData) {
            const message = JSON.parse(messageData);
            
            // Apply unread filter
            if (filters.unreadOnly && message.read) continue;

            messages.push(message);
          }
        } catch (error) {
          console.warn('[DWNStorageService] Error parsing message output:', error);
          continue;
        }
      }

      // Sort by timestamp (newest first) and apply limit
      messages.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      
      if (filters.limit) {
        return messages.slice(0, filters.limit);
      }

      console.log('[DWNStorageService] Retrieved', messages.length, 'messages');
      return messages;
    } catch (error) {
      console.error('[DWNStorageService] Error retrieving messages:', error);
      throw new Error(`Failed to retrieve DWN messages: ${error.message}`);
    }
  }

  /**
   * Get a specific message by ID
   */
  async getMessage(messageId: string, recipientDid: string): Promise<DWNMessage | null> {
    try {
      console.log('[DWNStorageService] Retrieving message:', messageId);

      const outputs = await this.walletClient.getUTXOs({
        basket: 'dwn-messages'
      });

      for (const output of outputs) {
        try {
          const customInstructions = JSON.parse(output.customInstructions || '{}');
          
          if (customInstructions.type !== 'dwn-message') continue;
          if (customInstructions.messageId !== messageId) continue;
          if (customInstructions.to !== recipientDid) continue;

          const messageData = this.extractDWNMessage(output.lockingScript);
          if (messageData) {
            return JSON.parse(messageData);
          }
        } catch (error) {
          console.warn('[DWNStorageService] Error parsing message output:', error);
          continue;
        }
      }

      return null;
    } catch (error) {
      console.error('[DWNStorageService] Error retrieving message:', error);
      throw new Error(`Failed to retrieve message: ${error.message}`);
    }
  }

  /**
   * Mark a message as read
   */
  async markMessageAsRead(messageId: string, recipientDid: string): Promise<boolean> {
    try {
      console.log('[DWNStorageService] Marking message as read:', messageId);

      // Get the current message
      const message = await this.getMessage(messageId, recipientDid);
      if (!message) {
        return false;
      }

      // Update the message with read status
      const updatedMessage: DWNMessage = {
        ...message,
        read: true,
        readAt: new Date()
      };

      // Store the updated message (this creates a new UTXO)
      await this.storeMessage(updatedMessage);

      // Note: In a production system, you might want to spend the old UTXO
      // to prevent duplicates, but for now we'll keep it simple
      
      return true;
    } catch (error) {
      console.error('[DWNStorageService] Error marking message as read:', error);
      return false;
    }
  }

  /**
   * Get message statistics for a DID
   */
  async getMessageStats(did: string): Promise<{
    totalReceived: number;
    totalSent: number;
    unread: number;
    typeBreakdown: Record<string, number>;
  }> {
    try {
      console.log('[DWNStorageService] Getting message stats for DID:', did);

      const outputs = await this.walletClient.getUTXOs({
        basket: 'dwn-messages'
      });

      let totalReceived = 0;
      let totalSent = 0;
      let unread = 0;
      const typeBreakdown: Record<string, number> = {};

      for (const output of outputs) {
        try {
          const customInstructions = JSON.parse(output.customInstructions || '{}');
          
          if (customInstructions.type !== 'dwn-message') continue;

          const messageData = this.extractDWNMessage(output.lockingScript);
          if (!messageData) continue;

          const message = JSON.parse(messageData);

          // Count received messages
          if (customInstructions.to === did) {
            totalReceived++;
            if (!message.read) {
              unread++;
            }

            // Type breakdown for received messages
            const messageType = customInstructions.messageType || 'unknown';
            typeBreakdown[messageType] = (typeBreakdown[messageType] || 0) + 1;
          }

          // Count sent messages
          if (customInstructions.from === did) {
            totalSent++;
          }
        } catch (error) {
          console.warn('[DWNStorageService] Error parsing message for stats:', error);
          continue;
        }
      }

      return {
        totalReceived,
        totalSent,
        unread,
        typeBreakdown
      };
    } catch (error) {
      console.error('[DWNStorageService] Error getting message stats:', error);
      throw new Error(`Failed to get message statistics: ${error.message}`);
    }
  }

  /**
   * Create a locking script for DWN message storage
   */
  private createDWNLockingScript(messageBytes: Byte[]): string {
    try {
      // Simple OP_RETURN script with message data
      const script = [
        0, // OP_FALSE
        106, // OP_RETURN
        ...this.encodeData(messageBytes)
      ];

      return Buffer.from(script).toString('hex');
    } catch (error) {
      console.error('[DWNStorageService] Error creating locking script:', error);
      throw error;
    }
  }

  /**
   * Extract DWN message from locking script
   */
  private extractDWNMessage(lockingScript: string): string | null {
    try {
      const scriptBytes = Buffer.from(lockingScript, 'hex');
      
      // Skip OP_FALSE (1 byte) and OP_RETURN (1 byte)
      if (scriptBytes.length < 2 || scriptBytes[0] !== 0 || scriptBytes[1] !== 106) {
        return null;
      }

      // Extract the message data
      const messageBytes = this.decodeData(scriptBytes.slice(2));
      return Utils.toUTF8(messageBytes);
    } catch (error) {
      console.warn('[DWNStorageService] Error extracting message from script:', error);
      return null;
    }
  }

  /**
   * Encode data for script
   */
  private encodeData(data: Byte[]): number[] {
    if (data.length <= 75) {
      return [data.length, ...data];
    } else if (data.length <= 255) {
      return [76, data.length, ...data]; // OP_PUSHDATA1
    } else {
      throw new Error('Message too large for single output');
    }
  }

  /**
   * Decode data from script
   */
  private decodeData(scriptBytes: Buffer): Byte[] {
    if (scriptBytes.length === 0) return [];

    const length = scriptBytes[0];
    if (length <= 75) {
      return Array.from(scriptBytes.slice(1, 1 + length));
    } else if (length === 76) { // OP_PUSHDATA1
      const dataLength = scriptBytes[1];
      return Array.from(scriptBytes.slice(2, 2 + dataLength));
    } else {
      throw new Error('Unsupported data encoding');
    }
  }
}

/**
 * Factory function to create DWN storage service
 */
export function createDWNStorageService(walletClient: WalletClient): DWNStorageService {
  return new DWNStorageService(walletClient);
}