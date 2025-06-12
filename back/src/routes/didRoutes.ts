/**
 * BSV DID Routes - Express router for BSV overlay DID operations
 * 
 * This module provides HTTP endpoints for creating, updating, and resolving
 * Decentralized Identifiers (DIDs) using the Bitcoin SV overlay method.
 * 
 * All endpoints require authentication via BSV auth middleware and return
 * standardized JSON responses with status and data/error information.
 */

import { Router, Request, Response } from 'express';
import { QuarkIdAgentService } from '../services/quarkIdAgentService';
import { type DIDDocument } from '@quarkid/did-core';

// Extend Express Request type to include quarkIdAgentService
declare global {
  namespace Express {
    interface Request {
      quarkIdAgentService?: QuarkIdAgentService;
    }
  }
}

/**
 * Creates Express router with BSV DID endpoints
 * 
 * @param quarkIdAgentService - Initialized QuarkID Agent service instance
 * @returns Express router with DID endpoints configured
 * 
 * @example
 * ```typescript
 * const service = new QuarkIdAgentService(config);
 * const router = createDidRoutes(service);
 * app.use('/v1/dids', router);
 * ```
 */
export const createDidRoutes = (quarkIdAgentService: QuarkIdAgentService): Router => {
  const router = Router();

  /**
   * POST /create - Create a new BSV DID
   * 
   * Creates a new Decentralized Identifier by broadcasting a transaction
   * to the BSV blockchain with an embedded DID document.
   * 
   * @route POST /create
   * @param {Object} req.body - Create DID request
   * @param {string} [req.body.name] - Optional name for the DID
   * 
   * @returns {Object} 200 - Success response with DID string
   * @returns {Object} 400 - Bad request (invalid input)
   * @returns {Object} 500 - Internal server error
   * 
   * @example
   * ```json
   * // Request
   * {
   *   "name": "My DID"
   * }
   * 
   * // Response
   * {
   *   "status": "success",
   *   "data": {
   *     "did": "did:modena:1234..."
   *   }
   * }
   * ```
   */
  router.post('/create', async (req: Request, res: Response) => {
    if (!quarkIdAgentService) {
      return res.status(500).json({
        status: 'error',
        description: 'QuarkIdAgentService not initialized.',
      });
    }

    try {
      const { name } = req.body;
      
      const did = await quarkIdAgentService.createDID();
      
      return res.status(201).json({
        status: 'success',
        data: {
          did
        },
      });

    } catch (error: any) {
      console.error('[Route /dids/create] Error:', error);
      const errorMessage = error.message || 'An internal error occurred during DID creation.';
      
      return res.status(500).json({ 
        status: 'error', 
        description: errorMessage 
      });
    }
  });

  /**
   * POST /update - Update an existing BSV DID
   * 
   * Updates an existing DID by adding verification methods or services.
   * 
   * @route POST /update
   * @param {Object} req.body - Update DID request
   * @param {string} req.body.did - DID to update
   * @param {Array} [req.body.verificationMethods] - Verification methods to add
   * @param {Array} [req.body.services] - Services to add
   * 
   * @returns {Object} 200 - Success response with updated DID document
   * @returns {Object} 400 - Bad request (invalid input)
   * @returns {Object} 500 - Internal server error
   */
  router.post('/update', async (req: Request, res: Response) => {
    if (!quarkIdAgentService) {
      return res.status(500).json({
        status: 'error',
        description: 'QuarkIdAgentService not initialized.',
      });
    }

    try {
      const { did, verificationMethods, services } = req.body;

      // Basic validation
      if (!did) {
        return res.status(400).json({
          status: 'error',
          description: 'Missing required field: did',
        });
      }

      const updatedDocument = await quarkIdAgentService.updateDID({
        did,
        verificationMethods,
        services
      });
      
      return res.status(200).json({
        status: 'success',
        data: {
          didDocument: updatedDocument
        },
      });

    } catch (error: any) {
      console.error('[Route /dids/update] Error:', error);
      const errorMessage = error.message || 'An internal error occurred during DID update.';
      
      return res.status(500).json({ 
        status: 'error', 
        description: errorMessage 
      });
    }
  });

  /**
   * GET /resolve/:did - Resolve a BSV DID
   * 
   * Retrieves the current DID document for a given BSV DID by querying
   * the overlay network. The DID parameter must be URL-encoded.
   * 
   * @route GET /resolve/:did
   * @param {string} req.params.did - URL-encoded BSV DID to resolve
   * 
   * @returns {Object} 200 - Success response with DID document
   * @returns {Object} 400 - Bad request (invalid DID format)
   * @returns {Object} 404 - DID not found
   * @returns {Object} 500 - Internal server error
   * 
   * @example
   * ```
   * GET /resolve/did%3Amodena%3A1234...
   * 
   * Response:
   * {
   *   "status": "success",
   *   "data": {
   *     "didDocument": {
   *       "@context": ["https://www.w3.org/ns/did/v1"],
   *       "id": "did:modena:1234...",
   *       "verificationMethod": [...]
   *     }
   *   }
   * }
   * ```
   */
  router.get('/resolve/:did', async (req: Request, res: Response) => {
    if (!quarkIdAgentService) {
      return res.status(500).json({
        status: 'error',
        description: 'QuarkIdAgentService not initialized.',
      });
    }

    try {
      const { did } = req.params;
      
      if (!did) {
        return res.status(400).json({
          status: 'error',
          description: 'DID parameter is required.',
        });
      }

      const didDocument = await quarkIdAgentService.resolveDID(did);
      
      if (!didDocument) {
        return res.status(404).json({
          status: 'error',
          description: 'DID not found.',
        });
      }
      
      return res.status(200).json({
        status: 'success',
        data: {
          didDocument
        },
      });

    } catch (error: any) {
      console.error(`[Route /dids/resolve/:did] Error:`, error);
      const errorMessage = error.message || 'An internal error occurred while resolving the DID.';
      
      return res.status(500).json({ 
        status: 'error', 
        description: errorMessage 
      });
    }
  });

  return router;
};
