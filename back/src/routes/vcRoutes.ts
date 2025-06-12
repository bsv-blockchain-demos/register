/**
 * VC Routes - Express router for Verifiable Credential operations
 * 
 * This module provides HTTP endpoints for issuing, verifying, and managing
 * Verifiable Credentials using the QuarkID Agent.
 */

import { Router, Request, Response } from 'express';
import { QuarkIdAgentService } from '../services/quarkIdAgentService';

// Extend Express Request type to include quarkIdAgentService
declare global {
  namespace Express {
    interface Request {
      quarkIdAgentService?: QuarkIdAgentService;
    }
  }
}

/**
 * Creates Express router with VC endpoints
 * 
 * @param quarkIdAgentService - Initialized QuarkID Agent service instance
 * @returns Express router with VC endpoints configured
 */
export const createVcRoutes = (quarkIdAgentService: QuarkIdAgentService): Router => {
  const router = Router();

  /**
   * POST /issue - Issue a new Verifiable Credential
   * 
   * @route POST /issue
   * @param {Object} req.body - Issue VC request
   * @param {string} req.body.issuerDid - DID of the issuer
   * @param {string} req.body.subjectDid - DID of the subject
   * @param {string} req.body.credentialType - Type of the credential
   * @param {Object} req.body.claims - Claims of the credential
   * @param {string} req.body.validFrom - Valid from date (optional)
   * @param {string} req.body.validUntil - Valid until date (optional)
   * 
   * @returns {Object} 201 - Success response with issued VC
   * @returns {Object} 400 - Bad request (invalid input)
   * @returns {Object} 500 - Internal server error
   */
  router.post('/issue', async (req: Request, res: Response) => {
    try {
      const quarkIdAgentService = (req as any).quarkIdAgentService as QuarkIdAgentService;
      const { issuerDid, subjectDid, credentialType, claims, validFrom, validUntil } = req.body;

      if (!issuerDid || !subjectDid || !credentialType || !claims) {
        return res.status(400).json({ 
          error: 'Missing required fields: issuerDid, subjectDid, credentialType, claims' 
        });
      }

      const vc = await quarkIdAgentService.issueVC(
        issuerDid,
        subjectDid,
        credentialType,
        claims,
        validFrom ? new Date(validFrom) : undefined,
        validUntil ? new Date(validUntil) : undefined
      );

      res.json({ 
        success: true, 
        verifiableCredential: vc 
      });
    } catch (error) {
      console.error('[VC Routes] Error issuing VC:', error);
      res.status(500).json({ 
        error: `Failed to issue VC: ${error.message}` 
      });
    }
  });

  /**
   * POST /verify - Verify a Verifiable Credential
   * 
   * @route POST /verify
   * @param {Object} req.body - Verify VC request
   * @param {Object} req.body.vc - Verifiable Credential to verify
   * 
   * @returns {Object} 200 - Success response with verification result
   * @returns {Object} 400 - Bad request (invalid input)
   * @returns {Object} 500 - Internal server error
   */
  router.post('/verify', async (req: Request, res: Response) => {
    if (!quarkIdAgentService) {
      return res.status(500).json({
        status: 'error',
        description: 'QuarkIdAgentService not initialized.',
      });
    }

    try {
      const { vc } = req.body;
      
      if (!vc) {
        return res.status(400).json({
          status: 'error',
          description: 'Missing required field: vc',
        });
      }

      const isValid = await quarkIdAgentService.verifyVC(vc);
      
      return res.status(200).json({
        status: 'success',
        data: {
          valid: isValid
        },
      });

    } catch (error: any) {
      console.error('[Route /vcs/verify] Error:', error);
      const errorMessage = error.message || 'An internal error occurred during VC verification.';
      
      return res.status(500).json({ 
        status: 'error', 
        description: errorMessage 
      });
    }
  });

  /**
   * GET /list - List all VCs for a given DID
   * 
   * @route GET /list
   * @param {string} req.query.did - DID to list VCs for
   * 
   * @returns {Object} 200 - Success response with list of VCs
   * @returns {Object} 400 - Bad request (missing DID)
   * @returns {Object} 500 - Internal server error
   */
  router.get('/list', async (req: Request, res: Response) => {
    if (!quarkIdAgentService) {
      return res.status(500).json({
        status: 'error',
        description: 'QuarkIdAgentService not initialized.',
      });
    }

    try {
      const { did } = req.query;
      
      if (!did || typeof did !== 'string') {
        return res.status(400).json({
          status: 'error',
          description: 'Missing required query parameter: did',
        });
      }

      const vcs = await quarkIdAgentService.getVCsForDID(did);
      
      return res.status(200).json({
        status: 'success',
        data: vcs,
      });

    } catch (error: any) {
      console.error('[Route /vcs/list] Error:', error);
      const errorMessage = error.message || 'An internal error occurred while listing VCs.';
      
      return res.status(500).json({ 
        status: 'error', 
        description: errorMessage 
      });
    }
  });

  return router;
};
