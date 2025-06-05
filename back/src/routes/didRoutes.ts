import { type Request, type Response, Router } from 'express';
import { type BsvDidService } from '../services/bsvDidService';
import { type UpdateDidRequest } from '@quarkid/did-registry';
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

export const createDidRoutes = (bsvDidService: BsvDidService): Router => {
  const router = Router();

  router.post('/bsv/update', async (req: Request, res: Response) => {
    if (!bsvDidService) {
      return res.status(500).json({
        status: 'error',
        description: 'BsvDidService not initialized on request object.',
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
      if (!didToUpdate || !newDidDocument || !currentBrc48TxHex || typeof currentBrc48Vout !== 'number' || typeof currentBrc48Satoshis !== 'number' || !currentControllerPrivateKeyHex) {
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
        newDidDocument: newDidDocument as DIDDocument, // Cast if necessary, ensure type compatibility
        currentBrc48TxHex,
        currentBrc48Vout,
        currentBrc48Satoshis,
        currentControllerPrivateKey: controllerPrivateKey,
        feePerKb: feePerKb ? Number(feePerKb) : undefined,
      };

      const result = await bsvDidService.updateDID(updateRequest);
      return res.status(200).json(result);

    } catch (error: any) {
      console.error('[Route /dids/bsv/update] Error:', error);
      const errorMessage = error.message || 'An internal error occurred during DID update.';
      // Check for specific error types or messages if needed for different status codes
      if (errorMessage.includes('Insufficient funds') || errorMessage.includes('UTXO')) {
        return res.status(400).json({ status: 'error', description: errorMessage });
      }
      return res.status(500).json({ status: 'error', description: errorMessage });
    }
  });

  // Future: Add a route for creating BRC-48 DIDs if needed
  /*
  router.post('/bsv/create', async (req: Request, res: Response) => {
    if (!req.bsvDidService) { // Or however the service is made available
      return res.status(500).json({ status: 'error', description: 'BsvDidService not available.' });
    }
    try {
      const { didDocument, controllerPublicKeyHex, feePerKb } = req.body;
      if (!didDocument || !controllerPublicKeyHex) {
        return res.status(400).json({ status: 'error', description: 'Missing didDocument or controllerPublicKeyHex.' });
      }
      const createRequest: CreateDidRequest = {
        didDocument: didDocument as DIDDocument,
        controllerPublicKeyHex,
        feePerKb: feePerKb ? Number(feePerKb) : undefined,
      };
      const result = await req.bsvDidService.createDID(createRequest);
      return res.status(201).json(result);
    } catch (error: any) {
      console.error('[Route /dids/bsv/create] Error:', error);
      return res.status(500).json({ status: 'error', description: error.message || 'Failed to create DID.' });
    }
  });
  */

  return router;
};
