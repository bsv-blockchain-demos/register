import { Router, Request, Response } from 'express';
import { 
  CreateActorRequest, 
  UpdateActorRequest,
  ActorResponse, 
  ActorListResponse, 
  ActorStatsResponse,
  ActorFilter,
  ApiError
} from '../types/common';

/**
 * Refactored Actor Routes with business logic properly delegated to services
 * 
 * This is a clean, focused router that handles HTTP concerns only:
 * - Request validation and parsing
 * - Response formatting
 * - Error handling
 * - Status codes
 * 
 * All business logic is delegated to the ActorService
 */
export function createActorRoutes(): Router {
  const router = Router();

  /**
   * POST /actors - Create a new actor
   */
  router.post('/', async (req: Request, res: Response) => {
    try {
      console.log('[ActorRoutes] POST /actors called');
      
      const actorData: CreateActorRequest = req.body;
      
      // Basic validation
      if (!actorData.name || !actorData.type) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: name, type'
        } as ApiError);
      }

      if (!req.quarkIdActorService) {
        return res.status(503).json({
          success: false,
          error: 'Actor service not available'
        } as ApiError);
      }

      // Delegate to service
      const actor = await req.quarkIdActorService.createActor(actorData);
      
      console.log('[ActorRoutes] Actor created successfully:', actor.id);
      
      res.status(201).json({
        success: true,
        data: actor,
        message: 'Actor created successfully'
      } as ActorResponse);

    } catch (error) {
      console.error('[ActorRoutes] Error creating actor:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create actor',
        details: error.message
      } as ApiError);
    }
  });

  /**
   * GET /actors - Get all actors with optional filtering
   */
  router.get('/', async (req: Request, res: Response) => {
    try {
      console.log('[ActorRoutes] GET /actors called');
      
      if (!req.quarkIdActorService) {
        return res.status(503).json({
          success: false,
          error: 'Actor service not available'
        } as ApiError);
      }

      // Parse query parameters
      const { type, status, active, limit = '100', offset = '0' } = req.query;
      
      const filter: ActorFilter = {};
      if (type) filter.type = type as any;
      if (status) filter.status = status as any;
      if (active !== undefined) filter.isActive = active === 'true';

      // Delegate to service
      const actors = await req.quarkIdActorService.getActors(
        filter,
        parseInt(limit as string),
        parseInt(offset as string)
      );
      
      console.log('[ActorRoutes] Found actors:', actors.length);
      
      res.json({
        success: true,
        data: actors,
        count: actors.length
      } as ActorListResponse);

    } catch (error) {
      console.error('[ActorRoutes] Error retrieving actors:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve actors',
        details: error.message
      } as ApiError);
    }
  });

  /**
   * GET /actors/:id - Get specific actor by ID
   */
  router.get('/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      if (!req.quarkIdActorService) {
        return res.status(503).json({
          success: false,
          error: 'Actor service not available'
        } as ApiError);
      }

      // Delegate to service
      const actor = await req.quarkIdActorService.getActorById(id);

      if (!actor) {
        return res.status(404).json({
          success: false,
          error: 'Actor not found'
        } as ApiError);
      }

      res.json({
        success: true,
        data: actor
      } as ActorResponse);

    } catch (error) {
      console.error('[ActorRoutes] Error retrieving actor:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve actor',
        details: error.message
      } as ApiError);
    }
  });

  /**
   * PUT /actors/:id - Update actor information
   */
  router.put('/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const updateData: UpdateActorRequest = req.body;

      if (!req.quarkIdActorService) {
        return res.status(503).json({
          success: false,
          error: 'Actor service not available'
        } as ApiError);
      }

      // Delegate to service
      const updatedActor = await req.quarkIdActorService.updateActor(id, updateData);

      if (!updatedActor) {
        return res.status(404).json({
          success: false,
          error: 'Actor not found'
        } as ApiError);
      }

      console.log('[ActorRoutes] Actor updated:', id);

      res.json({
        success: true,
        data: updatedActor,
        message: 'Actor updated successfully'
      } as ActorResponse);

    } catch (error) {
      console.error('[ActorRoutes] Error updating actor:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update actor',
        details: error.message
      } as ApiError);
    }
  });

  /**
   * DELETE /actors/:id - Delete an actor by ID
   */
  router.delete('/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      if (!req.quarkIdActorService) {
        return res.status(503).json({
          success: false,
          error: 'Actor service not available'
        } as ApiError);
      }

      // Get actor first to return info in response
      const actor = await req.quarkIdActorService.getActorById(id);
      
      if (!actor) {
        return res.status(404).json({
          success: false,
          error: 'Actor not found'
        } as ApiError);
      }

      // Delegate to service
      const deleted = await req.quarkIdActorService.deleteActor(id);

      if (!deleted) {
        return res.status(500).json({
          success: false,
          error: 'Failed to delete actor'
        } as ApiError);
      }

      res.json({
        success: true,
        message: `Actor ${actor.name} (${actor.type}) deleted successfully`,
        data: {
          id: actor.id,
          name: actor.name,
          type: actor.type,
          did: actor.did
        }
      });

    } catch (error) {
      console.error('[ActorRoutes] Error deleting actor:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete actor',
        details: error.message
      } as ApiError);
    }
  });

  /**
   * GET /actors/did/:did - Get actor by DID
   */
  router.get('/did/:did', async (req: Request, res: Response) => {
    try {
      const { did } = req.params;

      if (!req.quarkIdActorService) {
        return res.status(503).json({
          success: false,
          error: 'Actor service not available'
        } as ApiError);
      }

      // Delegate to service
      const actor = await req.quarkIdActorService.getActorByDid(did);

      if (!actor) {
        return res.status(404).json({
          success: false,
          error: 'Actor not found for this DID'
        } as ApiError);
      }

      res.json({
        success: true,
        data: actor
      } as ActorResponse);

    } catch (error) {
      console.error('[ActorRoutes] Error retrieving actor by DID:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve actor',
        details: error.message
      } as ApiError);
    }
  });

  /**
   * GET /actors/stats/summary - Get actor statistics
   */
  router.get('/stats/summary', async (req: Request, res: Response) => {
    try {
      if (!req.quarkIdActorService) {
        return res.status(503).json({
          success: false,
          error: 'Actor service not available'
        } as ApiError);
      }

      // Delegate to service
      const stats = await req.quarkIdActorService.getActorStatistics();

      res.json({
        success: true,
        data: stats
      } as ActorStatsResponse);

    } catch (error) {
      console.error('[ActorRoutes] Error retrieving actor stats:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve statistics',
        details: error.message
      } as ApiError);
    }
  });

  return router;
}

/**
 * Validation middleware for actor routes
 */
export const validateActorRoutes = (router: Router): Router => {
  // Add validation middleware here if needed
  return router;
};

/**
 * Error handling middleware for actor routes
 */
export const handleActorRouteErrors = (router: Router): Router => {
  // Add error handling middleware here if needed
  return router;
};