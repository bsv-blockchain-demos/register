import express from 'express';
import { WalletClient } from '@bsv/sdk';
import { Db } from 'mongodb';
import { 
  EnhancedQuarkIdActorService, 
  createEnhancedQuarkIdActorService,
  CreateActorRequest,
  UpdateActorRequest
} from '../services/enhancedQuarkIdActorService.js';

const router = express.Router();

// Extend Request interface to include our custom properties
interface CustomRequest extends express.Request {
  walletClient?: WalletClient;
  db?: Db;
  body: any;
  params: any;
  query: any;
}

/**
 * Enhanced actor routes using real BSV overlay DID management
 */

/**
 * @route POST /api/actors
 * @desc Create new actor with BSV overlay DID
 */
router.post('/', async (req: CustomRequest, res: express.Response) => {
  try {
    if (!req.db) {
      return res.status(500).json({ error: 'Database connection not available' });
    }

    if (!req.walletClient) {
      return res.status(500).json({ error: 'Wallet client not available' });
    }

    const { name, email, role } = req.body;

    // Validate input
    if (!name || !email || !role) {
      return res.status(400).json({ error: 'Name, email, and role are required' });
    }

    if (!['patient', 'doctor', 'pharmacy', 'insurance', 'regulator'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    // Create enhanced actor service
    const actorService = createEnhancedQuarkIdActorService(
      req.db,
      req.walletClient,
      {
        endpoint: process.env.BSV_OVERLAY_ENDPOINT || 'https://overlay.quarkid.org',
        topic: process.env.BSV_OVERLAY_TOPIC || 'did-registry'
      }
    );

    const actorData: CreateActorRequest = { name, email, role };
    const actor = await actorService.createActor(actorData);

    res.status(201).json({
      success: true,
      message: 'Actor created successfully with BSV overlay DID',
      data: actor
    });

  } catch (error) {
    console.error('Error creating actor:', error);
    res.status(500).json({
      error: 'Failed to create actor',
      details: error.message
    });
  }
});

/**
 * @route GET /api/actors
 * @desc Get all actors
 */
router.get('/', async (req: CustomRequest, res: express.Response) => {
  try {
    if (!req.db) {
      return res.status(500).json({ error: 'Database connection not available' });
    }

    if (!req.walletClient) {
      return res.status(500).json({ error: 'Wallet client not available' });
    }

    const actorService = createEnhancedQuarkIdActorService(req.db, req.walletClient);
    const actors = await actorService.listActors();

    res.json({
      success: true,
      data: actors,
      count: actors.length
    });

  } catch (error) {
    console.error('Error fetching actors:', error);
    res.status(500).json({
      error: 'Failed to fetch actors',
      details: error.message
    });
  }
});

/**
 * @route GET /api/actors/:id
 * @desc Get actor by ID
 */
router.get('/:id', async (req: CustomRequest, res: express.Response) => {
  try {
    if (!req.db) {
      return res.status(500).json({ error: 'Database connection not available' });
    }

    if (!req.walletClient) {
      return res.status(500).json({ error: 'Wallet client not available' });
    }

    const { id } = req.params;
    const actorService = createEnhancedQuarkIdActorService(req.db, req.walletClient);
    const actor = await actorService.getActor(id);

    if (!actor) {
      return res.status(404).json({ error: 'Actor not found' });
    }

    res.json({
      success: true,
      data: actor
    });

  } catch (error) {
    console.error('Error fetching actor:', error);
    res.status(500).json({
      error: 'Failed to fetch actor',
      details: error.message
    });
  }
});

/**
 * @route GET /api/actors/did/:did
 * @desc Get actor by DID
 */
router.get('/did/:did', async (req: CustomRequest, res: express.Response) => {
  try {
    if (!req.db) {
      return res.status(500).json({ error: 'Database connection not available' });
    }

    if (!req.walletClient) {
      return res.status(500).json({ error: 'Wallet client not available' });
    }

    const { did } = req.params;
    const decodedDid = decodeURIComponent(did);
    
    const actorService = createEnhancedQuarkIdActorService(req.db, req.walletClient);
    const actor = await actorService.getActorByDid(decodedDid);

    if (!actor) {
      return res.status(404).json({ error: 'Actor not found' });
    }

    res.json({
      success: true,
      data: actor
    });

  } catch (error) {
    console.error('Error fetching actor by DID:', error);
    res.status(500).json({
      error: 'Failed to fetch actor by DID',
      details: error.message
    });
  }
});

/**
 * @route GET /api/actors/role/:role
 * @desc Get actors by role
 */
router.get('/role/:role', async (req: CustomRequest, res: express.Response) => {
  try {
    if (!req.db) {
      return res.status(500).json({ error: 'Database connection not available' });
    }

    if (!req.walletClient) {
      return res.status(500).json({ error: 'Wallet client not available' });
    }

    const { role } = req.params;
    
    if (!['patient', 'doctor', 'pharmacy', 'insurance', 'regulator'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    const actorService = createEnhancedQuarkIdActorService(req.db, req.walletClient);
    const actors = await actorService.getActorsByRole(role);

    res.json({
      success: true,
      data: actors,
      count: actors.length
    });

  } catch (error) {
    console.error('Error fetching actors by role:', error);
    res.status(500).json({
      error: 'Failed to fetch actors by role',
      details: error.message
    });
  }
});

/**
 * @route PUT /api/actors/:id
 * @desc Update actor
 */
router.put('/:id', async (req: CustomRequest, res: express.Response) => {
  try {
    if (!req.db) {
      return res.status(500).json({ error: 'Database connection not available' });
    }

    if (!req.walletClient) {
      return res.status(500).json({ error: 'Wallet client not available' });
    }

    const { id } = req.params;
    const { name, email, status } = req.body;

    const updateData: UpdateActorRequest = {};
    if (name) updateData.name = name;
    if (email) updateData.email = email;
    if (status) updateData.status = status;

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: 'No valid update fields provided' });
    }

    const actorService = createEnhancedQuarkIdActorService(req.db, req.walletClient);
    const updatedActor = await actorService.updateActor(id, updateData);

    res.json({
      success: true,
      message: 'Actor updated successfully',
      data: updatedActor
    });

  } catch (error) {
    console.error('Error updating actor:', error);
    res.status(500).json({
      error: 'Failed to update actor',
      details: error.message
    });
  }
});

/**
 * @route POST /api/actors/:id/revoke
 * @desc Revoke actor DID
 */
router.post('/:id/revoke', async (req: CustomRequest, res: express.Response) => {
  try {
    if (!req.db) {
      return res.status(500).json({ error: 'Database connection not available' });
    }

    if (!req.walletClient) {
      return res.status(500).json({ error: 'Wallet client not available' });
    }

    const { id } = req.params;
    const actorService = createEnhancedQuarkIdActorService(req.db, req.walletClient);
    const revokedActor = await actorService.revokeActor(id);

    res.json({
      success: true,
      message: 'Actor DID revoked successfully',
      data: revokedActor
    });

  } catch (error) {
    console.error('Error revoking actor:', error);
    res.status(500).json({
      error: 'Failed to revoke actor DID',
      details: error.message
    });
  }
});

/**
 * @route GET /api/actors/resolve/:did
 * @desc Resolve DID from blockchain
 */
router.get('/resolve/:did', async (req: CustomRequest, res: express.Response) => {
  try {
    if (!req.db) {
      return res.status(500).json({ error: 'Database connection not available' });
    }

    if (!req.walletClient) {
      return res.status(500).json({ error: 'Wallet client not available' });
    }

    const { did } = req.params;
    const decodedDid = decodeURIComponent(did);
    
    const actorService = createEnhancedQuarkIdActorService(req.db, req.walletClient);
    const resolution = await actorService.resolveDid(decodedDid);

    res.json({
      success: true,
      data: resolution
    });

  } catch (error) {
    console.error('Error resolving DID:', error);
    res.status(500).json({
      error: 'Failed to resolve DID',
      details: error.message
    });
  }
});

export default router;
