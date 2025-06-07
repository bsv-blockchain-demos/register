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
import { BsvDidService } from '../services/bsvDidService';
import { type UpdateDidRequest, type CreateDidRequest } from '../lib/BsvOverlayDidRegistryService';
import { PrivateKey } from '@bsv/sdk';
import { type DIDDocument } from '@quarkid/did-core';

// Extend Express Request type to include bsvDidService
declare global {
  namespace Express {
    interface Request {
      bsvDidService?: BsvDidService;
    }
  }
}

/**
 * Creates Express router with BSV DID endpoints
 * 
 * @param bsvDidService - Initialized BSV DID service instance
 * @returns Express router with DID endpoints configured
 * 
 * @example
 * ```typescript
 * const service = new BsvDidService(config);
 * const router = createDidRoutes(service);
 * app.use('/v1/dids', router);
 * ```
 */
export const createDidRoutes = (bsvDidService: BsvDidService): Router => {
  const router = Router();

  /**
   * POST /create - Create a new BSV DID
   * 
   * Creates a new Decentralized Identifier by broadcasting a transaction
   * to the BSV blockchain with an embedded DID document.
   * 
   * @route POST /create
   * @param {Object} req.body - Create DID request
   * @param {Object} req.body.didDocument - W3C DID document structure
   * @param {string} req.body.controllerPublicKeyHex - 66-char hex public key
   * @param {number} [req.body.feePerKb] - Transaction fee in satoshis per KB
   * 
   * @returns {Object} 200 - Success response with txid and DID
   * @returns {Object} 400 - Bad request (invalid input or insufficient funds)
   * @returns {Object} 500 - Internal server error
   * 
   * @example
   * ```json
   * // Request
   * {
   *   "didDocument": {
   *     "@context": ["https://www.w3.org/ns/did/v1"],
   *     "verificationMethod": [...]
   *   },
   *   "controllerPublicKeyHex": "02abc123..."
   * }
   * 
   * // Response
   * {
   *   "status": "success",
   *   "txid": "a1b2c3...",
   *   "did": "did:bsv:topic:a1b2c3...:1"
   * }
   * ```
   */
  router.post('/create', async (req: Request, res: Response) => {
    if (!bsvDidService) {
      return res.status(500).json({
        status: 'error',
        description: 'BsvDidService not initialized.',
      });
    }

    try {
      const { didDocument, controllerPublicKeyHex, feePerKb } = req.body;
      
      // Basic validation
      if (!didDocument || !controllerPublicKeyHex) {
        return res.status(400).json({
          status: 'error',
          description: 'Missing required fields: didDocument and controllerPublicKeyHex are required.',
        });
      }

      const createRequest: CreateDidRequest = {
        didDocument: didDocument as DIDDocument,
        controllerPublicKeyHex,
        feePerKb: feePerKb ? Number(feePerKb) : undefined,
      };

      const result = await bsvDidService.createDID(createRequest);
      return res.status(201).json({
        status: 'success',
        data: result,
      });

    } catch (error: any) {
      console.error('[Route /dids/create] Error:', error);
      const errorMessage = error.message || 'An internal error occurred during DID creation.';
      
      // Handle specific error cases
      if (errorMessage.includes('Insufficient funds') || errorMessage.includes('UTXO')) {
        return res.status(400).json({ 
          status: 'error', 
          description: errorMessage 
        });
      }
      
      return res.status(500).json({ 
        status: 'error', 
        description: errorMessage 
      });
    }
  });

  /**
   * POST /update - Update an existing BSV DID
   * 
   * Updates an existing DID by creating a new transaction that references
   * the previous one and contains an updated DID document.
   * 
   * @route POST /update
   * @param {Object} req.body - Update DID request
   * @param {string} req.body.didToUpdate - Existing BSV DID to update
   * @param {Object} req.body.newDidDocument - Updated W3C DID document
   * @param {string} req.body.currentBrc48TxHex - Current transaction hex
   * @param {number} req.body.currentBrc48Vout - Current output index
   * @param {number} req.body.currentBrc48Satoshis - Current UTXO satoshis
   * @param {string} req.body.currentControllerPrivateKeyHex - Current controller private key
   * @param {number} [req.body.feePerKb] - Transaction fee in satoshis per KB
   * 
   * @returns {Object} 200 - Success response with new txid and DID
   * @returns {Object} 400 - Bad request (invalid input or DID not found)
   * @returns {Object} 500 - Internal server error
   * 
   * @example
   * ```json
   * // Request
   * {
   *   "didToUpdate": "did:bsv:topic:prev_txid:1",
   *   "newDidDocument": { ... },
   *   "currentBrc48TxHex": "0100000001...",
   *   "currentBrc48Vout": 1,
   *   "currentBrc48Satoshis": 1000,
   *   "currentControllerPrivateKeyHex": "abc123..."
   * }
   * 
   * // Response
   * {
   *   "status": "success",
   *   "txid": "b2c3d4...",
   *   "did": "did:bsv:topic:b2c3d4...:1"
   * }
   * ```
   */
  router.post('/update', async (req: Request, res: Response) => {
    if (!bsvDidService) {
      return res.status(500).json({
        status: 'error',
        description: 'BsvDidService not initialized.',
      });
    }

    try {
      const {
        didToUpdate,
        newDidDocument,
        currentBrc48TxHex,
        currentBrc48Vout,
        currentBrc48Satoshis,
        currentControllerPrivateKeyHex, // Expecting private key as hex string from request
        feePerKb,
      } = req.body;

      // Basic validation
      if (!didToUpdate || !newDidDocument || !currentBrc48TxHex || 
          typeof currentBrc48Vout !== 'number' || 
          typeof currentBrc48Satoshis !== 'number' || 
          !currentControllerPrivateKeyHex) {
        return res.status(400).json({
          status: 'error',
          description: 'Missing required fields for DID update.',
        });
      }

      let controllerPrivateKey: PrivateKey;
      try {
        controllerPrivateKey = PrivateKey.fromHex(currentControllerPrivateKeyHex);
      } catch (err) {
        return res.status(400).json({
          status: 'error',
          description: 'Invalid currentControllerPrivateKeyHex format.',
        });
      }

      const updateRequest: UpdateDidRequest = {
        didToUpdate,
        newDidDocument: newDidDocument as DIDDocument,
        currentBrc48TxHex,
        currentBrc48Vout,
        currentBrc48Satoshis,
        currentControllerPrivateKeyHex: controllerPrivateKey.toHex(),
        newControllerPublicKeyHex: controllerPrivateKey.toPublicKey().toString(),
        feePerKb: feePerKb ? Number(feePerKb) : undefined,
      };

      const result = await bsvDidService.updateDID(updateRequest);
      return res.status(200).json({
        status: 'success',
        data: result,
      });

    } catch (error: any) {
      console.error('[Route /dids/update] Error:', error);
      const errorMessage = error.message || 'An internal error occurred during DID update.';
      
      if (errorMessage.includes('Insufficient funds') || errorMessage.includes('UTXO')) {
        return res.status(400).json({ 
          status: 'error', 
          description: errorMessage 
        });
      }
      
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
   * GET /resolve/did%3Absv%3Atopic%3Aabc123...%3A1
   * 
   * Response:
   * {
   *   "status": "success",
   *   "didDocument": {
   *     "@context": ["https://www.w3.org/ns/did/v1"],
   *     "id": "did:bsv:topic:abc123...:1",
   *     "verificationMethod": [...]
   *   }
   * }
   * ```
   */
  router.get('/resolve/:did', async (req: Request, res: Response) => {
    if (!bsvDidService) {
      return res.status(500).json({
        status: 'error',
        description: 'BsvDidService not initialized.',
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

      const result = await bsvDidService.resolveDID(did);
      return res.status(200).json({
        status: 'success',
        data: result,
      });

    } catch (error: any) {
      console.error(`[Route /dids/resolve/:did] Error:`, error);
      const errorMessage = error.message || 'An internal error occurred while resolving the DID.';
      
      if (errorMessage.includes('not found')) {
        return res.status(404).json({ 
          status: 'error', 
          description: errorMessage 
        });
      }
      
      return res.status(500).json({ 
        status: 'error', 
        description: errorMessage 
      });
    }
  });

  return router;
};
