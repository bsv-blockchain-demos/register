import { Router, Request, Response } from 'express';
import { PrivateKey, WalletClient } from '@bsv/sdk';
import { Db } from 'mongodb';
import { BsvDidService } from '../services/bsvDidService';
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
 * Actor interface for the prescription system
 */
interface Actor {
  id: string;
  did?: string;
  name: string;
  type: 'patient' | 'doctor' | 'pharmacy' | 'insurance';
  email?: string;
  phone?: string;
  address?: string;
  publicKey?: string;
  privateKey?: string; // Only stored temporarily for demo purposes
  licenseNumber?: string; // For doctors and pharmacies
  specialization?: string; // For doctors
  insuranceProvider?: string; // For patients
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
}

/**
 * Create actor management routes
 */
export function createActorRoutes(): Router {
  const router = Router();

  /**
   * POST /actors - Create a new actor with DID
   * Body: {
   *   name: string,
   *   type: 'patient' | 'doctor' | 'pharmacy' | 'insurance',
   *   email?: string,
   *   phone?: string,
   *   address?: string,
   *   licenseNumber?: string,
   *   specialization?: string,
   *   insuranceProvider?: string
   * }
   */
  router.post('/', async (req: CustomRequest, res: Response) => {
    try {
      const {
        name,
        type,
        email,
        phone,
        address,
        licenseNumber,
        specialization,
        insuranceProvider
      } = req.body;

      // Validate required fields
      if (!name || !type) {
        return res.status(400).json({
          error: 'Missing required fields: name, type'
        });
      }

      if (!['patient', 'doctor', 'pharmacy', 'insurance'].includes(type)) {
        return res.status(400).json({
          error: 'Invalid actor type. Must be: patient, doctor, pharmacy, or insurance'
        });
      }

      if (!req.db) {
        return res.status(503).json({
          error: 'Database not available'
        });
      }

      // Generate key pair for the actor (simplified implementation)
      const key = PrivateKey.fromRandom()
      const privateKey = key.toString()
      const publicKey = key.toPublicKey().toString()

      // Create DID document for the actor
      const didDocument = {
        '@context': ['https://www.w3.org/ns/did/v1'],
        id: '', // Will be set after DID creation
        verificationMethod: [{
          id: '#key-1',
          type: 'EcdsaSecp256k1VerificationKey2019',
          controller: '',
          publicKeyHex: publicKey
        }],
        authentication: ['#key-1'],
        assertionMethod: ['#key-1']
      };

      // Create BSV DID (in production, would use actual BSV DID service)
      let did = '';
      try {
        // Mock DID creation - in production, would use BsvDidService
        did = `did:bsv:quarkid-prescription:${crypto.randomBytes(16).toString('hex')}:1`;
        didDocument.id = did;
        didDocument.verificationMethod[0].controller = did;
      } catch (error) {
        console.warn('[ActorRoutes] DID creation failed, proceeding without DID:', error.message);
      }

      // Create actor
      const actor: Actor = {
        id: crypto.randomUUID(),
        did,
        name,
        type,
        email,
        phone,
        address,
        publicKey,
        privateKey, // Only for demo - in production, stays on client side
        licenseNumber,
        specialization,
        insuranceProvider,
        createdAt: new Date(),
        updatedAt: new Date(),
        isActive: true
      };

      // Store actor in database
      await req.db.collection('actors').insertOne(actor);

      // Store DID document if created
      if (did) {
        await req.db.collection('did_documents').insertOne({
          did,
          document: didDocument,
          actorId: actor.id,
          createdAt: new Date()
        });
      }

      console.log(`[ActorRoutes] Actor created: ${actor.id} (${type})`);

      // Remove private key from response
      const responseActor = { ...actor };
      delete responseActor.privateKey;

      res.status(201).json({
        success: true,
        data: responseActor,
        message: 'Actor created successfully'
      });

    } catch (error) {
      console.error('[ActorRoutes] Error creating actor:', error);
      res.status(500).json({
        error: 'Failed to create actor',
        details: error.message
      });
    }
  });

  /**
   * GET /actors - Get all actors
   * Query params:
   *   - type?: string - Filter by actor type
   *   - active?: boolean - Filter by active status
   */
  router.get('/', async (req: CustomRequest, res: Response) => {
    try {
      const { type, active } = req.query;

      if (!req.db) {
        return res.status(503).json({
          error: 'Database not available'
        });
      }

      let query: any = {};

      if (type) {
        query.type = type;
      }

      if (active !== undefined) {
        query.isActive = active === 'true';
      }

      const actors = await req.db
        .collection('actors')
        .find(query, { projection: { privateKey: 0 } }) // Exclude private keys
        .sort({ createdAt: -1 })
        .toArray();

      res.json({
        success: true,
        data: actors,
        count: actors.length
      });

    } catch (error) {
      console.error('[ActorRoutes] Error retrieving actors:', error);
      res.status(500).json({
        error: 'Failed to retrieve actors',
        details: error.message
      });
    }
  });

  /**
   * GET /actors/:id - Get specific actor by ID
   */
  router.get('/:id', async (req: CustomRequest, res: Response) => {
    try {
      const { id } = req.params;

      if (!req.db) {
        return res.status(503).json({
          error: 'Database not available'
        });
      }

      const actor = await req.db
        .collection('actors')
        .findOne(
          { id },
          { projection: { privateKey: 0 } } // Exclude private key
        );

      if (!actor) {
        return res.status(404).json({
          error: 'Actor not found'
        });
      }

      res.json({
        success: true,
        data: actor
      });

    } catch (error) {
      console.error('[ActorRoutes] Error retrieving actor:', error);
      res.status(500).json({
        error: 'Failed to retrieve actor',
        details: error.message
      });
    }
  });

  /**
   * PUT /actors/:id - Update actor information
   */
  router.put('/:id', async (req: CustomRequest, res: Response) => {
    try {
      const { id } = req.params;
      const updateData = { ...req.body };

      // Remove fields that shouldn't be updated
      delete updateData.id;
      delete updateData.did;
      delete updateData.privateKey;
      delete updateData.publicKey;
      delete updateData.createdAt;

      // Add updated timestamp
      updateData.updatedAt = new Date();

      if (!req.db) {
        return res.status(503).json({
          error: 'Database not available'
        });
      }

      const result = await req.db
        .collection('actors')
        .updateOne(
          { id },
          { $set: updateData }
        );

      if (result.matchedCount === 0) {
        return res.status(404).json({
          error: 'Actor not found'
        });
      }

      // Get updated actor
      const updatedActor = await req.db
        .collection('actors')
        .findOne(
          { id },
          { projection: { privateKey: 0 } }
        );

      console.log(`[ActorRoutes] Actor updated: ${id}`);

      res.json({
        success: true,
        data: updatedActor,
        message: 'Actor updated successfully'
      });

    } catch (error) {
      console.error('[ActorRoutes] Error updating actor:', error);
      res.status(500).json({
        error: 'Failed to update actor',
        details: error.message
      });
    }
  });

  /**
   * DELETE /actors/:id - Deactivate actor (soft delete)
   */
  router.delete('/:id', async (req: CustomRequest, res: Response) => {
    try {
      const { id } = req.params;

      if (!req.db) {
        return res.status(503).json({
          error: 'Database not available'
        });
      }

      const result = await req.db
        .collection('actors')
        .updateOne(
          { id },
          { 
            $set: { 
              isActive: false,
              updatedAt: new Date()
            } 
          }
        );

      if (result.matchedCount === 0) {
        return res.status(404).json({
          error: 'Actor not found'
        });
      }

      console.log(`[ActorRoutes] Actor deactivated: ${id}`);

      res.json({
        success: true,
        message: 'Actor deactivated successfully'
      });

    } catch (error) {
      console.error('[ActorRoutes] Error deactivating actor:', error);
      res.status(500).json({
        error: 'Failed to deactivate actor',
        details: error.message
      });
    }
  });

  /**
   * GET /actors/did/:did - Get actor by DID
   */
  router.get('/did/:did', async (req: CustomRequest, res: Response) => {
    try {
      const { did } = req.params;

      if (!req.db) {
        return res.status(503).json({
          error: 'Database not available'
        });
      }

      const actor = await req.db
        .collection('actors')
        .findOne(
          { did },
          { projection: { privateKey: 0 } }
        );

      if (!actor) {
        return res.status(404).json({
          error: 'Actor not found for this DID'
        });
      }

      res.json({
        success: true,
        data: actor
      });

    } catch (error) {
      console.error('[ActorRoutes] Error retrieving actor by DID:', error);
      res.status(500).json({
        error: 'Failed to retrieve actor',
        details: error.message
      });
    }
  });

  /**
   * POST /actors/:id/credentials - Get credentials for actor (private key, etc.)
   * This endpoint requires special authorization and is only for testing
   */
  router.post('/:id/credentials', async (req: CustomRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { purpose } = req.body; // 'signing', 'testing', etc.

      if (!purpose) {
        return res.status(400).json({
          error: 'Missing required field: purpose'
        });
      }

      if (!req.db) {
        return res.status(503).json({
          error: 'Database not available'
        });
      }

      const actor = await req.db
        .collection('actors')
        .findOne({ id });

      if (!actor) {
        return res.status(404).json({
          error: 'Actor not found'
        });
      }

      // Return credentials (in production, this would require proper authorization)
      res.json({
        success: true,
        data: {
          did: actor.did,
          publicKey: actor.publicKey,
          privateKey: actor.privateKey, // Only for demo purposes
          purpose
        },
        warning: 'This endpoint is for testing only. In production, private keys should never be exposed via API.'
      });

    } catch (error) {
      console.error('[ActorRoutes] Error retrieving credentials:', error);
      res.status(500).json({
        error: 'Failed to retrieve credentials',
        details: error.message
      });
    }
  });

  /**
   * GET /actors/stats/summary - Get actor statistics
   */
  router.get('/stats/summary', async (req: CustomRequest, res: Response) => {
    try {
      if (!req.db) {
        return res.status(503).json({
          error: 'Database not available'
        });
      }

      const totalActors = await req.db.collection('actors').countDocuments();
      const activeActors = await req.db.collection('actors').countDocuments({ isActive: true });

      // Get breakdown by type
      const typeBreakdown = await req.db.collection('actors').aggregate([
        { $match: { isActive: true } },
        { $group: { _id: '$type', count: { $sum: 1 } } }
      ]).toArray();

      res.json({
        success: true,
        data: {
          total: totalActors,
          active: activeActors,
          inactive: totalActors - activeActors,
          typeBreakdown: typeBreakdown.reduce((acc, item) => {
            acc[item._id] = item.count;
            return acc;
          }, {})
        }
      });

    } catch (error) {
      console.error('[ActorRoutes] Error retrieving actor stats:', error);
      res.status(500).json({
        error: 'Failed to retrieve statistics',
        details: error.message
      });
    }
  });

  return router;
}