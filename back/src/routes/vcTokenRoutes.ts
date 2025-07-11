import { Router, Request, Response } from 'express';
import { VCTokenService } from '../services/vcTokenService';

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      vcTokenService?: VCTokenService;
    }
  }
}

/**
 * Creates Express router with unified VC Token endpoints
 * This consolidates VC and token operations into atomic workflows
 */
export const createVCTokenRoutes = (vcTokenService: VCTokenService): Router => {
  const router = Router();

  /**
   * POST /create - Create a new VC Token (atomic VC + BSV token creation)
   * 
   * @route POST /create
   * @param {Object} req.body - Create VC Token request
   * @param {string} req.body.issuerDid - DID of the issuer
   * @param {string} req.body.subjectDid - DID of the subject
   * @param {string} req.body.credentialType - Type of the credential
   * @param {Object} req.body.claims - Claims of the credential
   * @param {Object} req.body.metadata - Optional metadata
   * @param {string} req.body.validFrom - Valid from date (optional)
   * @param {string} req.body.validUntil - Valid until date (optional)
   * 
   * @returns {Object} 201 - Success response with VC Token
   * @returns {Object} 400 - Bad request (invalid input)
   * @returns {Object} 500 - Internal server error
   */
  router.post('/create', async (req: Request, res: Response) => {
    try {
      const {
        issuerDid,
        subjectDid,
        credentialType,
        claims,
        metadata,
        validFrom,
        validUntil
      } = req.body;

      // Validate required fields
      if (!issuerDid || !subjectDid || !credentialType || !claims) {
        return res.status(400).json({
          error: 'Missing required fields: issuerDid, subjectDid, credentialType, claims'
        });
      }

      // Create VC Token atomically
      const vcToken = await vcTokenService.createVCToken({
        issuerDid,
        subjectDid,
        credentialType,
        claims,
        metadata,
        validFrom: validFrom ? new Date(validFrom) : undefined,
        validUntil: validUntil ? new Date(validUntil) : undefined
      });

      res.status(201).json({
        success: true,
        data: vcToken,
        message: 'VC Token created successfully'
      });

    } catch (error) {
      console.error('[VCTokenRoutes] Error creating VC token:', error);
      res.status(500).json({
        error: `Failed to create VC token: ${error.message}`
      });
    }
  });

  /**
   * POST /transfer - Transfer a VC Token to a new owner
   * 
   * @route POST /transfer
   * @param {Object} req.body - Transfer request
   * @param {string} req.body.tokenId - ID of the token to transfer
   * @param {string} req.body.fromDid - DID of current owner
   * @param {string} req.body.toDid - DID of new owner
   * @param {Object} req.body.metadata - Optional transfer metadata
   * 
   * @returns {Object} 200 - Success response with updated VC Token
   * @returns {Object} 400 - Bad request (invalid input)
   * @returns {Object} 403 - Forbidden (not authorized)
   * @returns {Object} 404 - Token not found
   * @returns {Object} 500 - Internal server error
   */
  router.post('/transfer', async (req: Request, res: Response) => {
    try {
      const { tokenId, fromDid, toDid, metadata } = req.body;

      if (!tokenId || !fromDid || !toDid) {
        return res.status(400).json({
          error: 'Missing required fields: tokenId, fromDid, toDid'
        });
      }

      const updatedToken = await vcTokenService.transferVCToken(
        tokenId,
        fromDid,
        toDid,
        metadata
      );

      res.json({
        success: true,
        data: updatedToken,
        message: 'VC Token transferred successfully'
      });

    } catch (error) {
      console.error('[VCTokenRoutes] Error transferring VC token:', error);
      
      if (error.message.includes('not found')) {
        return res.status(404).json({ error: error.message });
      }
      if (error.message.includes('Unauthorized')) {
        return res.status(403).json({ error: error.message });
      }
      
      res.status(500).json({
        error: `Failed to transfer VC token: ${error.message}`
      });
    }
  });

  /**
   * POST /finalize - Finalize a VC Token (mark as used/completed)
   * 
   * @route POST /finalize
   * @param {Object} req.body - Finalize request
   * @param {string} req.body.tokenId - ID of the token to finalize
   * @param {string} req.body.finalizerDid - DID of the finalizer
   * @param {Object} req.body.metadata - Optional finalization metadata
   * 
   * @returns {Object} 200 - Success response with finalized VC Token
   * @returns {Object} 400 - Bad request (invalid input)
   * @returns {Object} 403 - Forbidden (not authorized)
   * @returns {Object} 404 - Token not found
   * @returns {Object} 409 - Conflict (already finalized)
   * @returns {Object} 500 - Internal server error
   */
  router.post('/finalize', async (req: Request, res: Response) => {
    try {
      const { tokenId, finalizerDid, metadata } = req.body;

      if (!tokenId || !finalizerDid) {
        return res.status(400).json({
          error: 'Missing required fields: tokenId, finalizerDid'
        });
      }

      const finalizedToken = await vcTokenService.finalizeVCToken(
        tokenId,
        finalizerDid,
        metadata
      );

      res.json({
        success: true,
        data: finalizedToken,
        message: 'VC Token finalized successfully'
      });

    } catch (error) {
      console.error('[VCTokenRoutes] Error finalizing VC token:', error);
      
      if (error.message.includes('not found')) {
        return res.status(404).json({ error: error.message });
      }
      if (error.message.includes('Unauthorized')) {
        return res.status(403).json({ error: error.message });
      }
      if (error.message.includes('already finalized')) {
        return res.status(409).json({ error: error.message });
      }
      
      res.status(500).json({
        error: `Failed to finalize VC token: ${error.message}`
      });
    }
  });

  /**
   * GET /:tokenId - Get a specific VC Token by ID
   * 
   * @route GET /:tokenId
   * @param {string} req.params.tokenId - Token ID
   * 
   * @returns {Object} 200 - Success response with VC Token
   * @returns {Object} 404 - Token not found
   * @returns {Object} 500 - Internal server error
   */
  router.get('/:tokenId', async (req: Request, res: Response) => {
    try {
      const { tokenId } = req.params;

      const token = await vcTokenService.getVCToken(tokenId);
      
      if (!token) {
        return res.status(404).json({
          error: 'VC Token not found'
        });
      }

      res.json({
        success: true,
        data: token
      });

    } catch (error) {
      console.error('[VCTokenRoutes] Error retrieving VC token:', error);
      res.status(500).json({
        error: `Failed to retrieve VC token: ${error.message}`
      });
    }
  });

  /**
   * GET /list - List VC Tokens with filters
   * 
   * @route GET /list
   * @param {string} req.query.issuerDid - Filter by issuer DID
   * @param {string} req.query.subjectDid - Filter by subject DID
   * @param {string} req.query.currentOwnerDid - Filter by current owner DID
   * @param {string} req.query.type - Filter by credential type
   * @param {string} req.query.status - Filter by status (active, transferred, finalized)
   * 
   * @returns {Object} 200 - Success response with array of VC Tokens
   * @returns {Object} 500 - Internal server error
   */
  router.get('/list', async (req: Request, res: Response) => {
    try {
      const filter: any = {};
      
      if (req.query.issuerDid) filter.issuerDid = req.query.issuerDid as string;
      if (req.query.subjectDid) filter.subjectDid = req.query.subjectDid as string;
      if (req.query.currentOwnerDid) filter.currentOwnerDid = req.query.currentOwnerDid as string;
      if (req.query.type) filter.type = req.query.type as string;
      if (req.query.status) filter.status = req.query.status as any;

      const tokens = await vcTokenService.getVCTokens(filter);

      res.json({
        success: true,
        data: tokens,
        count: tokens.length
      });

    } catch (error) {
      console.error('[VCTokenRoutes] Error listing VC tokens:', error);
      res.status(500).json({
        error: `Failed to list VC tokens: ${error.message}`
      });
    }
  });

  /**
   * POST /verify/:tokenId - Verify a VC Token
   * 
   * @route POST /verify/:tokenId
   * @param {string} req.params.tokenId - Token ID to verify
   * 
   * @returns {Object} 200 - Success response with verification result
   * @returns {Object} 404 - Token not found
   * @returns {Object} 500 - Internal server error
   */
  router.post('/verify/:tokenId', async (req: Request, res: Response) => {
    try {
      const { tokenId } = req.params;

      const verificationResult = await vcTokenService.verifyVCToken(tokenId);

      res.json({
        success: true,
        data: verificationResult
      });

    } catch (error) {
      console.error('[VCTokenRoutes] Error verifying VC token:', error);
      res.status(500).json({
        error: `Failed to verify VC token: ${error.message}`
      });
    }
  });

  /**
   * GET /stats/summary - Get VC Token statistics
   * 
   * @route GET /stats/summary
   * 
   * @returns {Object} 200 - Success response with statistics
   * @returns {Object} 500 - Internal server error
   */
  router.get('/stats/summary', async (req: Request, res: Response) => {
    try {
      const stats = await vcTokenService.getStatistics();

      res.json({
        success: true,
        data: stats
      });

    } catch (error) {
      console.error('[VCTokenRoutes] Error getting VC token stats:', error);
      res.status(500).json({
        error: `Failed to get VC token statistics: ${error.message}`
      });
    }
  });

  /**
   * Special route for prescription-specific operations
   * This demonstrates how to build domain-specific operations on top of the generic VC Token service
   */
  
  /**
   * POST /prescription/create - Create a prescription VC Token
   * Simplified endpoint specifically for prescriptions
   */
  router.post('/prescription/create', async (req: Request, res: Response) => {
    try {
      const {
        doctorDid,
        patientDid,
        medicationName,
        dosage,
        quantity,
        instructions,
        diagnosisCode,
        insuranceDid,
        expiryDays = 30
      } = req.body;

      if (!doctorDid || !patientDid || !medicationName || !dosage || !quantity) {
        return res.status(400).json({
          error: 'Missing required prescription fields'
        });
      }

      // Create prescription-specific claims
      const claims = {
        medication: {
          name: medicationName,
          dosage,
          quantity,
          instructions
        },
        diagnosis: diagnosisCode,
        insurance: insuranceDid,
        prescribedAt: new Date().toISOString()
      };

      // Calculate expiry
      const validUntil = new Date();
      validUntil.setDate(validUntil.getDate() + expiryDays);

      // Create prescription VC Token
      const vcToken = await vcTokenService.createVCToken({
        issuerDid: doctorDid,
        subjectDid: patientDid,
        credentialType: 'PrescriptionCredential',
        claims,
        metadata: {
          description: `Prescription for ${medicationName}`,
          customData: {
            prescriptionType: 'standard',
            requiresPharmacyValidation: true
          }
        },
        validFrom: new Date(),
        validUntil
      });

      res.status(201).json({
        success: true,
        data: vcToken,
        message: 'Prescription VC Token created successfully'
      });

    } catch (error) {
      console.error('[VCTokenRoutes] Error creating prescription:', error);
      res.status(500).json({
        error: `Failed to create prescription: ${error.message}`
      });
    }
  });

  /**
   * POST /prescription/dispense - Transfer prescription to pharmacy for dispensing
   */
  router.post('/prescription/dispense', async (req: Request, res: Response) => {
    try {
      const { tokenId, patientDid, pharmacyDid } = req.body;

      if (!tokenId || !patientDid || !pharmacyDid) {
        return res.status(400).json({
          error: 'Missing required fields: tokenId, patientDid, pharmacyDid'
        });
      }

      // Transfer to pharmacy with dispensing metadata
      const updatedToken = await vcTokenService.transferVCToken(
        tokenId,
        patientDid,
        pharmacyDid,
        {
          action: 'dispense',
          timestamp: new Date().toISOString()
        }
      );

      res.json({
        success: true,
        data: updatedToken,
        message: 'Prescription transferred to pharmacy for dispensing'
      });

    } catch (error) {
      console.error('[VCTokenRoutes] Error dispensing prescription:', error);
      res.status(500).json({
        error: `Failed to dispense prescription: ${error.message}`
      });
    }
  });

  return router;
};