import { Router, Request, Response } from 'express';
import { BsvVcService, CreateVcRequest } from '../services/bsvVcService';
import { VerifiableCredential } from '@quarkid/vc-core';

const router = Router();

// Extended Request interface to include our services
interface ExtendedRequest extends Request {
  vcService?: BsvVcService;
  body: any;
  params: any;
}

/**
 * Issue a new Verifiable Credential
 * POST /v1/vcs/issue
 */
router.post('/issue', async (req: ExtendedRequest, res: Response) => {
  try {
    const { vcDocument, issuerDid, subjectDid, controllerPublicKeyHex } = req.body;

    // Validate required fields
    if (!vcDocument || !issuerDid || !subjectDid || !controllerPublicKeyHex) {
      return res.status(400).json({
        error: 'Missing required fields: vcDocument, issuerDid, subjectDid, controllerPublicKeyHex'
      });
    }

    if (!req.vcService) {
      return res.status(500).json({
        error: 'VC service not available'
      });
    }

    const createVcRequest: CreateVcRequest = {
      vcDocument: vcDocument as VerifiableCredential,
      issuerDid,
      subjectDid,
      controllerPublicKeyHex
    };

    const result = await req.vcService.issueVC(createVcRequest);

    res.status(201).json({
      success: true,
      message: 'Verifiable Credential issued successfully',
      vc: result
    });
  } catch (error) {
    console.error('Error issuing VC:', error);
    res.status(500).json({
      error: 'Failed to issue Verifiable Credential',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Revoke a Verifiable Credential
 * POST /v1/vcs/revoke
 */
router.post('/revoke', async (req: ExtendedRequest, res: Response) => {
  try {
    const { vcId, issuerDid, controllerPublicKeyHex } = req.body;

    // Validate required fields
    if (!vcId || !issuerDid || !controllerPublicKeyHex) {
      return res.status(400).json({
        error: 'Missing required fields: vcId, issuerDid, controllerPublicKeyHex'
      });
    }

    if (!req.vcService) {
      return res.status(500).json({
        error: 'VC service not available'
      });
    }

    const txid = await req.vcService.revokeVC(vcId, issuerDid, controllerPublicKeyHex);

    res.json({
      success: true,
      message: 'Verifiable Credential revoked successfully',
      vcId,
      txid
    });
  } catch (error) {
    console.error('Error revoking VC:', error);
    res.status(500).json({
      error: 'Failed to revoke Verifiable Credential',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Resolve a Verifiable Credential
 * GET /v1/vcs/resolve/:vcId
 */
router.get('/resolve/:vcId', async (req: ExtendedRequest, res: Response) => {
  try {
    const { vcId } = req.params;

    if (!vcId) {
      return res.status(400).json({
        error: 'VC ID is required'
      });
    }

    if (!req.vcService) {
      return res.status(500).json({
        error: 'VC service not available'
      });
    }

    const vcData = await req.vcService.resolveVC(vcId);

    res.json({
      success: true,
      vc: vcData
    });
  } catch (error) {
    console.error('Error resolving VC:', error);
    res.status(404).json({
      error: 'Verifiable Credential not found',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get all VCs for a subject DID
 * GET /v1/vcs/subject/:subjectDid
 */
router.get('/subject/:subjectDid', async (req: ExtendedRequest, res: Response) => {
  try {
    const { subjectDid } = req.params;

    if (!subjectDid) {
      return res.status(400).json({
        error: 'Subject DID is required'
      });
    }

    if (!req.vcService) {
      return res.status(500).json({
        error: 'VC service not available'
      });
    }

    const vcs = await req.vcService.getVCsForSubject(subjectDid);

    res.json({
      success: true,
      subjectDid,
      count: vcs.length,
      vcs
    });
  } catch (error) {
    console.error('Error getting VCs for subject:', error);
    res.status(500).json({
      error: 'Failed to retrieve VCs for subject',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get all VCs issued by an issuer DID
 * GET /v1/vcs/issuer/:issuerDid
 */
router.get('/issuer/:issuerDid', async (req: ExtendedRequest, res: Response) => {
  try {
    const { issuerDid } = req.params;

    if (!issuerDid) {
      return res.status(400).json({
        error: 'Issuer DID is required'
      });
    }

    if (!req.vcService) {
      return res.status(500).json({
        error: 'VC service not available'
      });
    }

    const vcs = await req.vcService.getVCsByIssuer(issuerDid);

    res.json({
      success: true,
      issuerDid,
      count: vcs.length,
      vcs
    });
  } catch (error) {
    console.error('Error getting VCs by issuer:', error);
    res.status(500).json({
      error: 'Failed to retrieve VCs by issuer',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Health check for VC service
 * GET /v1/vcs/health
 */
router.get('/health', (req: ExtendedRequest, res: Response) => {
  try {
    const isVcServiceAvailable = !!req.vcService;
    
    res.json({
      success: true,
      service: 'BSV VC Service',
      status: isVcServiceAvailable ? 'operational' : 'unavailable',
      timestamp: new Date().toISOString(),
      features: [
        'VC Issuance',
        'VC Revocation',
        'VC Resolution',
        'Subject VC Lookup',
        'Issuer VC Lookup'
      ]
    });
  } catch (error) {
    console.error('Error in VC health check:', error);
    res.status(500).json({
      error: 'Health check failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
