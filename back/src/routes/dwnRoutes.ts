import { Router, Request, Response } from 'express';
import { WalletClient } from '@bsv/sdk';
import { Db } from 'mongodb';
import crypto from 'crypto';

// Extend Request interface to include our custom properties
interface CustomRequest extends Request {
  walletClient?: WalletClient;
  db?: Db;
  body: any;
  params: any;
  query: any;
}

/**
 * DWN Message interface for secure VC transmission
 */
interface DWNMessage {
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
}

/**
 * Create DWN messaging routes for secure VC transmission
 */
export function createDWNRoutes(): Router {
  const router = Router();

  /**
   * POST /dwn/send - Send encrypted VC via DWN
   * Body: {
   *   from: string,        // Sender DID
   *   to: string,          // Recipient DID
   *   subject: string,     // Message subject
   *   vcData: any,         // VC data to encrypt and send
   *   type: 'prescription' | 'dispensation' | 'confirmation',
   *   prescriptionId?: string,
   *   threadId?: string,
   *   urgent?: boolean
   * }
   */
  router.post('/send', async (req: CustomRequest, res: Response) => {
    try {
      const {
        from,
        to,
        subject,
        vcData,
        type,
        prescriptionId,
        threadId,
        urgent = false
      } = req.body;

      // Validate required fields
      if (!from || !to || !subject || !vcData || !type) {
        return res.status(400).json({
          error: 'Missing required fields: from, to, subject, vcData, type'
        });
      }

      if (!req.db) {
        return res.status(503).json({
          error: 'Database not available'
        });
      }

      // Encrypt the VC data (simplified implementation)
      const encryptedPayload = await encryptVCData(vcData, to);

      // Create DWN message
      const message: DWNMessage = {
        id: crypto.randomUUID(),
        type,
        from,
        to,
        subject,
        encryptedPayload,
        timestamp: new Date(),
        threadId: threadId || crypto.randomUUID(),
        metadata: {
          prescriptionId,
          vcType: type,
          urgent
        }
      };

      // Store message in database (acting as DWN node)
      await req.db.collection('dwn_messages').insertOne(message);

      // In a real DWN implementation, this would route the message
      // through the decentralized network to the recipient's DWN node
      console.log(`[DWNRoutes] Message sent from ${from} to ${to}: ${message.id}`);

      res.status(201).json({
        success: true,
        data: {
          messageId: message.id,
          threadId: message.threadId,
          timestamp: message.timestamp
        },
        message: 'Message sent successfully via DWN'
      });

    } catch (error) {
      console.error('[DWNRoutes] Error sending message:', error);
      res.status(500).json({
        error: 'Failed to send message',
        details: error.message
      });
    }
  });

  /**
   * GET /dwn/messages - Retrieve DWN messages for a specific DID
   * Query params:
   *   - did: string (required) - DID to retrieve messages for
   *   - type?: string - Filter by message type
   *   - threadId?: string - Filter by thread ID
   *   - unreadOnly?: boolean - Only unread messages
   *   - limit?: number - Limit number of results
   */
  router.get('/messages', async (req: CustomRequest, res: Response) => {
    try {
      const { did, type, threadId, unreadOnly, limit = 50 } = req.query;

      if (!did) {
        return res.status(400).json({
          error: 'Missing required query parameter: did'
        });
      }

      if (!req.db) {
        return res.status(503).json({
          error: 'Database not available'
        });
      }

      // Build query
      let query: any = { to: did };

      if (type) {
        query.type = type;
      }

      if (threadId) {
        query.threadId = threadId;
      }

      if (unreadOnly === 'true') {
        query.read = { $ne: true };
      }

      // Retrieve messages
      const messages = await req.db
        .collection('dwn_messages')
        .find(query)
        .sort({ timestamp: -1 })
        .limit(parseInt(limit as string))
        .toArray();

      // Return messages without decrypting (client should decrypt)
      const publicMessages = messages.map(msg => ({
        id: msg.id,
        type: msg.type,
        from: msg.from,
        to: msg.to,
        subject: msg.subject,
        timestamp: msg.timestamp,
        threadId: msg.threadId,
        metadata: msg.metadata,
        read: msg.read || false
        // Note: encryptedPayload not included for security
      }));

      res.json({
        success: true,
        data: publicMessages,
        count: publicMessages.length
      });

    } catch (error) {
      console.error('[DWNRoutes] Error retrieving messages:', error);
      res.status(500).json({
        error: 'Failed to retrieve messages',
        details: error.message
      });
    }
  });

  /**
   * GET /dwn/messages/:messageId - Get specific message and decrypt payload
   * Query params:
   *   - recipientDid: string (required) - DID of recipient for authorization
   */
  router.get('/messages/:messageId', async (req: CustomRequest, res: Response) => {
    try {
      const { messageId } = req.params;
      const { recipientDid } = req.query;

      if (!recipientDid) {
        return res.status(400).json({
          error: 'Missing required query parameter: recipientDid'
        });
      }

      if (!req.db) {
        return res.status(503).json({
          error: 'Database not available'
        });
      }

      // Retrieve message
      const message = await req.db
        .collection('dwn_messages')
        .findOne({ id: messageId });

      if (!message) {
        return res.status(404).json({
          error: 'Message not found'
        });
      }

      // Verify recipient authorization
      if (message.to !== recipientDid) {
        return res.status(403).json({
          error: 'Unauthorized: You can only access messages sent to your DID'
        });
      }

      // Decrypt payload (simplified implementation)
      const decryptedPayload = await decryptVCData(message.encryptedPayload, recipientDid as string);

      // Mark message as read
      await req.db
        .collection('dwn_messages')
        .updateOne(
          { id: messageId },
          { $set: { read: true, readAt: new Date() } }
        );

      res.json({
        success: true,
        data: {
          ...message,
          decryptedPayload,
          encryptedPayload: undefined // Remove encrypted payload from response
        }
      });

    } catch (error) {
      console.error('[DWNRoutes] Error retrieving message:', error);
      res.status(500).json({
        error: 'Failed to retrieve message',
        details: error.message
      });
    }
  });

  /**
   * PUT /dwn/messages/:messageId/read - Mark message as read
   */
  router.put('/messages/:messageId/read', async (req: CustomRequest, res: Response) => {
    try {
      const { messageId } = req.params;
      const { recipientDid } = req.body;

      if (!recipientDid) {
        return res.status(400).json({
          error: 'Missing required field: recipientDid'
        });
      }

      if (!req.db) {
        return res.status(503).json({
          error: 'Database not available'
        });
      }

      // Verify message exists and recipient authorization
      const message = await req.db
        .collection('dwn_messages')
        .findOne({ id: messageId, to: recipientDid });

      if (!message) {
        return res.status(404).json({
          error: 'Message not found or unauthorized'
        });
      }

      // Mark as read
      const result = await req.db
        .collection('dwn_messages')
        .updateOne(
          { id: messageId },
          { 
            $set: { 
              read: true, 
              readAt: new Date() 
            } 
          }
        );

      if (result.matchedCount === 0) {
        return res.status(404).json({
          error: 'Message not found'
        });
      }

      res.json({
        success: true,
        message: 'Message marked as read'
      });

    } catch (error) {
      console.error('[DWNRoutes] Error marking message as read:', error);
      res.status(500).json({
        error: 'Failed to mark message as read',
        details: error.message
      });
    }
  });

  /**
   * GET /dwn/threads/:threadId - Get all messages in a thread
   */
  router.get('/threads/:threadId', async (req: CustomRequest, res: Response) => {
    try {
      const { threadId } = req.params;
      const { participantDid } = req.query;

      if (!participantDid) {
        return res.status(400).json({
          error: 'Missing required query parameter: participantDid'
        });
      }

      if (!req.db) {
        return res.status(503).json({
          error: 'Database not available'
        });
      }

      // Get all messages in thread where user is participant
      const messages = await req.db
        .collection('dwn_messages')
        .find({
          threadId,
          $or: [
            { from: participantDid },
            { to: participantDid }
          ]
        })
        .sort({ timestamp: 1 })
        .toArray();

      if (messages.length === 0) {
        return res.status(404).json({
          error: 'Thread not found or no access'
        });
      }

      // Return public message info (no encrypted payloads)
      const threadMessages = messages.map(msg => ({
        id: msg.id,
        type: msg.type,
        from: msg.from,
        to: msg.to,
        subject: msg.subject,
        timestamp: msg.timestamp,
        metadata: msg.metadata,
        read: msg.read || false
      }));

      res.json({
        success: true,
        data: {
          threadId,
          messages: threadMessages,
          messageCount: threadMessages.length
        }
      });

    } catch (error) {
      console.error('[DWNRoutes] Error retrieving thread:', error);
      res.status(500).json({
        error: 'Failed to retrieve thread',
        details: error.message
      });
    }
  });

  /**
   * GET /dwn/stats/:did - Get messaging statistics for a DID
   */
  router.get('/stats/:did', async (req: CustomRequest, res: Response) => {
    try {
      const { did } = req.params;

      if (!req.db) {
        return res.status(503).json({
          error: 'Database not available'
        });
      }

      const totalReceived = await req.db.collection('dwn_messages').countDocuments({ to: did });
      const totalSent = await req.db.collection('dwn_messages').countDocuments({ from: did });
      const unread = await req.db.collection('dwn_messages').countDocuments({ 
        to: did, 
        read: { $ne: true } 
      });

      // Get message type breakdown
      const typeBreakdown = await req.db.collection('dwn_messages').aggregate([
        { $match: { to: did } },
        { $group: { _id: '$type', count: { $sum: 1 } } }
      ]).toArray();

      res.json({
        success: true,
        data: {
          totalReceived,
          totalSent,
          unread,
          typeBreakdown: typeBreakdown.reduce((acc, item) => {
            acc[item._id] = item.count;
            return acc;
          }, {})
        }
      });

    } catch (error) {
      console.error('[DWNRoutes] Error retrieving DWN stats:', error);
      res.status(500).json({
        error: 'Failed to retrieve statistics',
        details: error.message
      });
    }
  });

  return router;
}

/**
 * Encrypt VC data for transmission (simplified implementation)
 * In production, this would use the recipient's public key
 */
async function encryptVCData(vcData: any, recipientDid: string): Promise<string> {
  try {
    const vcString = JSON.stringify(vcData);
    // Simplified encryption - in production, use proper public key encryption
    const encrypted = Buffer.from(vcString).toString('base64');
    return `encrypted:${recipientDid}:${encrypted}`;
  } catch (error) {
    console.error('[DWNRoutes] Error encrypting VC data:', error);
    throw new Error('Failed to encrypt VC data');
  }
}

/**
 * Decrypt VC data (simplified implementation)
 * In production, this would use the recipient's private key
 */
async function decryptVCData(encryptedPayload: string, recipientDid: string): Promise<any> {
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
    console.error('[DWNRoutes] Error decrypting VC data:', error);
    throw new Error('Failed to decrypt VC data');
  }
}