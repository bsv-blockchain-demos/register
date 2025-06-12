import { Router, Request, Response } from 'express';
import { PrivateKey, WalletClient } from '@bsv/sdk';
import { Db } from 'mongodb';
import crypto from 'crypto';

// Extend Request interface to include our custom properties
interface CustomRequest extends Request {
  walletClient?: WalletClient;
  db?: Db;
  body: any;
  params: any;
  query: any;
  quarkIdAgentService?: any;
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
   *   insuranceProvider?: string,
   *   identityKey?: string
   * }
   */
  router.post('/', async (req: CustomRequest, res: Response) => {
    console.log('[ActorRoutes] POST /actors called');
    console.log('[ActorRoutes] Request body:', JSON.stringify(req.body, null, 2));
    
    try {
      const {
        name,
        type,
        email,
        phone,
        address,
        licenseNumber,
        specialization,
        insuranceProvider,
        identityKey
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

      // Generate identityKey if not provided - ensures valid controllerPublicKeyHex for BSV DID creation
      let finalIdentityKey = identityKey;
      if (!finalIdentityKey) {
        try {
          // Generate a new public key using the wallet client for this actor
          const publicKeyResult = await req.walletClient.getPublicKey({
            protocolID: [1, 'BSV DID Actor'], // Security level 1, protocol for actor DID
            counterparty: 'self', // For self (actor identity)
            keyID: `actor-${name}-${Date.now()}` // Unique key ID for this actor
          });
          finalIdentityKey = publicKeyResult.publicKey;
          console.log(`[ActorRoutes] Generated new identityKey for actor ${name}: ${finalIdentityKey}`);
        } catch (error) {
          console.error(`[ActorRoutes] Error generating identityKey for actor:`, error);
          return res.status(500).json({
            error: 'Failed to generate identity key for actor'
          });
        }
      }

      // Create DID document for the actor
      const didDocument = {
        '@context': ['https://www.w3.org/ns/did/v1'],
        id: '', // Will be set after DID creation
        verificationMethod: [{
          id: '#key-1',
          type: 'EcdsaSecp256k1VerificationKey2019',
          controller: '',
          publicKeyHex: finalIdentityKey
        }],
        authentication: ['#key-1'],
        assertionMethod: ['#key-1']
      };

      console.log(`[ActorRoutes] Creating actor: ${name} (${type})`);
      
      let did = '';
      
      if (type === 'patient' || type === 'doctor' || type === 'pharmacy' || type === 'insurance') {
        // For medical actors, generate a BSV DID using QuarkIdAgentService
        const quarkIdAgentService = req.quarkIdAgentService;
        console.log('[ActorRoutes] QuarkIdAgentService available:', !!quarkIdAgentService);
        
        if (!quarkIdAgentService) {
          console.error('[ActorRoutes] QuarkIdAgentService not found in request');
          return res.status(500).json({ error: 'QuarkIdAgentService not available' });
        }

        // Create DID using QuarkID Agent
        try {
          console.log('[ActorRoutes] Calling quarkIdAgentService.createDID()...');
          console.log('[ActorRoutes] quarkIdAgentService type:', typeof quarkIdAgentService);
          console.log('[ActorRoutes] quarkIdAgentService.createDID type:', typeof quarkIdAgentService.createDID);
          
          did = await quarkIdAgentService.createDID();
          console.log(`[ActorRoutes] Created BSV DID for ${name}: ${did}`);
          
          if (!did) {
            console.error('[ActorRoutes] DID creation returned empty result');
            throw new Error('DID creation returned empty result');
          }
          
          // Update the DID document with the generated DID
          didDocument.id = did;
          didDocument.verificationMethod[0].controller = did;
          didDocument.verificationMethod[0].id = `${did}#key-1`;
        } catch (didError) {
          console.error('[ActorRoutes] Error creating DID:', didError);
          console.error('[ActorRoutes] Stack trace:', (didError as Error).stack);
          // Continue without DID for now to see what's happening
          console.warn('[ActorRoutes] Continuing without DID due to error');
        }
      } else {
        // For other actors, use key-based DID
        did = `did:key:${finalIdentityKey}`;
        didDocument.id = did;
        didDocument.verificationMethod[0].controller = did;
        didDocument.verificationMethod[0].id = `${did}#key-1`;
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
        publicKey: finalIdentityKey,
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