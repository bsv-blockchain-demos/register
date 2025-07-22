import { Router, Request, Response } from 'express';
import { WalletClient } from '@bsv/sdk';
import { Db } from 'mongodb';
import * as crypto from 'crypto';

// Extend Request interface to include our custom properties
interface CustomRequest extends Request {
  walletClient?: WalletClient;
  db?: Db;
  body: any;
  params: any;
  query: any;
}

/**
 * BSV Token interface for prescription management
 */
interface BSVToken {
  txid: string;
  vout: number;
  satoshis: number;
  script: string;
  status: 'no dispensado' | 'dispensado';
  unlockableBy: string; // DID
  metadata: {
    prescriptionId: string;
    medicationInfo: string;
    batchNumber?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Create token management routes
 */
export function createTokenRoutes(): Router {
  const router = Router();

  /**
   * POST /tokens - Create a new BSV token for a prescription
   * Body: {
   *   prescriptionId: string,
   *   patientDid: string,
   *   medicationInfo: string,
   *   satoshis?: number
   * }
   */
  router.post('/', async (req: CustomRequest, res: Response) => {
    try {
      const {
        prescriptionId,
        patientDid,
        medicationInfo,
        satoshis = 1000
      } = req.body;

      // Validate required fields
      if (!prescriptionId || !patientDid || !medicationInfo) {
        return res.status(400).json({
          error: 'Missing required fields: prescriptionId, patientDid, medicationInfo'
        });
      }

      if (!req.db) {
        return res.status(503).json({
          error: 'Database not available'
        });
      }

      // Check if token already exists for this prescription
      const existingToken = await req.db
        .collection('tokens')
        .findOne({ 'metadata.prescriptionId': prescriptionId });

      if (existingToken) {
        return res.status(409).json({
          error: 'Token already exists for this prescription',
          data: existingToken
        });
      }

      // Generate mock transaction ID (in production, this would be a real BSV transaction)
      const txid = crypto.randomBytes(32).toString('hex');

      // Create token
      const token: BSVToken = {
        txid,
        vout: 1,
        satoshis,
        script: generateP2PKHScript(patientDid),
        status: 'no dispensado',
        unlockableBy: patientDid,
        metadata: {
          prescriptionId,
          medicationInfo
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Store token in database
      await req.db.collection('tokens').insertOne(token);

      console.log(`[TokenRoutes] Token created: ${txid} for prescription: ${prescriptionId}`);

      res.status(201).json({
        success: true,
        data: token,
        message: 'Token created successfully'
      });

    } catch (error) {
      console.error('[TokenRoutes] Error creating token:', error);
      res.status(500).json({
        error: 'Failed to create token',
        details: error.message
      });
    }
  });

  /**
   * GET /tokens/:txid - Get token details by transaction ID
   */
  router.get('/:txid', async (req: CustomRequest, res: Response) => {
    try {
      const txid = req.params.txid;

      if (!req.db) {
        return res.status(503).json({
          error: 'Database not available'
        });
      }

      const token = await req.db
        .collection('tokens')
        .findOne({ txid });

      if (!token) {
        return res.status(404).json({
          error: 'Token not found'
        });
      }

      res.json({
        success: true,
        data: token
      });

    } catch (error) {
      console.error('[TokenRoutes] Error retrieving token:', error);
      res.status(500).json({
        error: 'Failed to retrieve token',
        details: error.message
      });
    }
  });

  /**
   * GET /tokens/:txid/status - Get token status
   */
  router.get('/:txid/status', async (req: CustomRequest, res: Response) => {
    try {
      const txid = req.params.txid;

      if (!req.db) {
        return res.status(503).json({
          error: 'Database not available'
        });
      }

      const token = await req.db
        .collection('tokens')
        .findOne({ txid }, { projection: { status: 1, unlockableBy: 1, metadata: 1 } });

      if (!token) {
        return res.status(404).json({
          error: 'Token not found'
        });
      }

      res.json({
        success: true,
        data: {
          txid,
          status: token.status,
          unlockableBy: token.unlockableBy,
          prescriptionId: token.metadata.prescriptionId
        }
      });

    } catch (error) {
      console.error('[TokenRoutes] Error retrieving token status:', error);
      res.status(500).json({
        error: 'Failed to retrieve token status',
        details: error.message
      });
    }
  });

  /**
   * PUT /tokens/:txid/transfer - Transfer token ownership
   * Body: {
   *   newOwnerDid: string,
   *   batchNumber?: string
   * }
   */
  router.put('/:txid/transfer', async (req: CustomRequest, res: Response) => {
    try {
      const txid = req.params.txid;
      const { newOwnerDid, batchNumber } = req.body;

      if (!newOwnerDid) {
        return res.status(400).json({
          error: 'Missing required field: newOwnerDid'
        });
      }

      if (!req.db) {
        return res.status(503).json({
          error: 'Database not available'
        });
      }

      // Get current token
      const currentToken = await req.db
        .collection('tokens')
        .findOne({ txid });

      if (!currentToken) {
        return res.status(404).json({
          error: 'Token not found'
        });
      }

      if (currentToken.status === 'dispensado') {
        return res.status(409).json({
          error: 'Cannot transfer token that has already been dispensed'
        });
      }

      // Update token ownership
      const updateData: any = {
        unlockableBy: newOwnerDid,
        script: generateP2PKHScript(newOwnerDid),
        updatedAt: new Date()
      };

      // Add batch number if provided
      if (batchNumber) {
        updateData['metadata.batchNumber'] = batchNumber;
      }

      const result = await req.db
        .collection('tokens')
        .updateOne(
          { txid },
          { $set: updateData }
        );

      if (result.matchedCount === 0) {
        return res.status(404).json({
          error: 'Token not found'
        });
      }

      // Get updated token
      const updatedToken = await req.db
        .collection('tokens')
        .findOne({ txid });

      console.log(`[TokenRoutes] Token transferred: ${txid} to ${newOwnerDid}`);

      res.json({
        success: true,
        data: updatedToken,
        message: 'Token transferred successfully'
      });

    } catch (error) {
      console.error('[TokenRoutes] Error transferring token:', error);
      res.status(500).json({
        error: 'Failed to transfer token',
        details: error.message
      });
    }
  });

  /**
   * PUT /tokens/:txid/finalize - Finalize token status to "dispensado"
   * Body: {
   *   patientDid: string
   * }
   */
  router.put('/:txid/finalize', async (req: CustomRequest, res: Response) => {
    try {
      const txid = req.params.txid;
      const { patientDid } = req.body;

      if (!patientDid) {
        return res.status(400).json({
          error: 'Missing required field: patientDid'
        });
      }

      if (!req.db) {
        return res.status(503).json({
          error: 'Database not available'
        });
      }

      // Get current token
      const currentToken = await req.db
        .collection('tokens')
        .findOne({ txid });

      if (!currentToken) {
        return res.status(404).json({
          error: 'Token not found'
        });
      }

      if (currentToken.status === 'dispensado') {
        return res.status(409).json({
          error: 'Token has already been finalized'
        });
      }

      // Verify that the patient is requesting finalization
      // In a more sophisticated system, we'd verify the patient's signature
      const originalPatientDid = await getOriginalPatientDid(req.db, currentToken.metadata.prescriptionId);
      if (originalPatientDid !== patientDid) {
        return res.status(403).json({
          error: 'Only the original patient can finalize this token'
        });
      }

      // Update token status to dispensado
      const result = await req.db
        .collection('tokens')
        .updateOne(
          { txid },
          { 
            $set: { 
              status: 'dispensado',
              updatedAt: new Date()
            } 
          }
        );

      if (result.matchedCount === 0) {
        return res.status(404).json({
          error: 'Token not found'
        });
      }

      // Get updated token
      const finalizedToken = await req.db
        .collection('tokens')
        .findOne({ txid });

      console.log(`[TokenRoutes] Token finalized: ${txid} by patient ${patientDid}`);

      res.json({
        success: true,
        data: finalizedToken,
        message: 'Token finalized successfully'
      });

    } catch (error) {
      console.error('[TokenRoutes] Error finalizing token:', error);
      res.status(500).json({
        error: 'Failed to finalize token',
        details: error.message
      });
    }
  });

  /**
   * GET /tokens/prescription/:prescriptionId - Get token by prescription ID
   */
  router.get('/prescription/:prescriptionId', async (req: CustomRequest, res: Response) => {
    try {
      const prescriptionId = req.params.prescriptionId;

      if (!req.db) {
        return res.status(503).json({
          error: 'Database not available'
        });
      }

      const token = await req.db
        .collection('tokens')
        .findOne({ 'metadata.prescriptionId': prescriptionId });

      if (!token) {
        return res.status(404).json({
          error: 'Token not found for this prescription'
        });
      }

      res.json({
        success: true,
        data: token
      });

    } catch (error) {
      console.error('[TokenRoutes] Error retrieving token by prescription:', error);
      res.status(500).json({
        error: 'Failed to retrieve token',
        details: error.message
      });
    }
  });

  /**
   * GET /tokens/actor/:did - Get all tokens for a specific actor
   */
  router.get('/actor/:did', async (req: CustomRequest, res: Response) => {
    try {
      const actorDid = req.params.did;

      if (!req.db) {
        return res.status(503).json({
          error: 'Database not available'
        });
      }

      const tokens = await req.db
        .collection('tokens')
        .find({ unlockableBy: actorDid })
        .sort({ createdAt: -1 })
        .toArray();

      res.json({
        success: true,
        data: tokens,
        count: tokens.length
      });

    } catch (error) {
      console.error('[TokenRoutes] Error retrieving actor tokens:', error);
      res.status(500).json({
        error: 'Failed to retrieve tokens',
        details: error.message
      });
    }
  });

  /**
   * GET /tokens/stats/summary - Get token statistics
   */
  router.get('/stats/summary', async (req: CustomRequest, res: Response) => {
    try {
      if (!req.db) {
        return res.status(503).json({
          error: 'Database not available'
        });
      }

      const totalTokens = await req.db.collection('tokens').countDocuments();
      const activeTokens = await req.db.collection('tokens').countDocuments({ status: 'no dispensado' });
      const dispensedTokens = await req.db.collection('tokens').countDocuments({ status: 'dispensado' });

      // Get total value of tokens
      const valueResult = await req.db.collection('tokens').aggregate([
        {
          $group: {
            _id: null,
            totalValue: { $sum: '$satoshis' }
          }
        }
      ]).toArray();

      const totalValue = valueResult.length > 0 ? valueResult[0].totalValue : 0;

      res.json({
        success: true,
        data: {
          total: totalTokens,
          active: activeTokens,
          dispensed: dispensedTokens,
          totalValue
        }
      });

    } catch (error) {
      console.error('[TokenRoutes] Error retrieving token stats:', error);
      res.status(500).json({
        error: 'Failed to retrieve token statistics',
        details: error.message
      });
    }
  });

  return router;
}

/**
 * Generate a P2PKH script for a given DID
 */
function generateP2PKHScript(did: string): string {
  const didHash = crypto.createHash('sha256').update(did).digest('hex').substring(0, 40);
  return `76a914${didHash}88ac`;
}

/**
 * Get the original patient DID for a prescription
 */
async function getOriginalPatientDid(db: Db, prescriptionId: string): Promise<string | null> {
  const prescription = await db
    .collection('prescriptions')
    .findOne(
      { 'credentialSubject.prescription.id': prescriptionId },
      { projection: { 'credentialSubject.id': 1 } }
    );

  return prescription ? prescription.credentialSubject.id : null;
}