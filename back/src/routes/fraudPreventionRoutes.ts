import { Router, Request, Response } from 'express';
import { InsuranceFraudPreventionService } from '../services/InsuranceFraudPreventionService';
import { ValidationMiddleware, ErrorMiddleware } from '../middleware/validation';
import { 
  ApiError, 
  ApiResponse, 
  QuarkIdRequest 
} from '../types/common';

/**
 * Insurance Fraud Prevention API Routes
 * 
 * Provides endpoints for all actors in the healthcare fraud prevention system:
 * - Doctors: Create prescription credentials with BBS+ signatures
 * - Pharmacies: Generate dispensing proofs and verify prescriptions
 * - Insurance Companies: Verify claims using selective disclosure ZKPs
 * - Patients: Confirm medication receipt
 * - Auditors: Access full disclosure for compliance
 */

export function createFraudPreventionRoutes(): Router {
  const router = Router();

  /**
   * POST /fraud-prevention/prescription/create
   * Doctor creates a prescription credential with BBS+ selective disclosure capabilities
   */
  router.post('/prescription/create', 
    ValidationMiddleware.requireFields(['doctorDid', 'patientDid', 'prescriptionData', 'patientInfo', 'doctorInfo']),
    ErrorMiddleware.asyncHandler(async (req: QuarkIdRequest, res: Response) => {
      try {
        console.log('[FraudPreventionRoutes] Creating prescription credential');

        const { doctorDid, patientDid, prescriptionData, patientInfo, doctorInfo } = req.body;
        
        const fraudPreventionService = req.fraudPreventionService;
        if (!fraudPreventionService) {
          return res.status(503).json({
            success: false,
            error: 'Fraud prevention service not available'
          } as ApiError);
        }

        // Validate prescription data structure
        const requiredPrescriptionFields = ['medicationName', 'dosage', 'frequency', 'duration', 'quantity', 'refills', 'validUntil'];
        const missingFields = requiredPrescriptionFields.filter(field => !prescriptionData[field]);
        if (missingFields.length > 0) {
          return res.status(400).json({
            success: false,
            error: `Missing prescription fields: ${missingFields.join(', ')}`
          } as ApiError);
        }

        const result = await fraudPreventionService.createPrescriptionCredential({
          doctorDid,
          patientDid,
          prescriptionData,
          patientInfo,
          doctorInfo
        });

        console.log('[FraudPreventionRoutes] Prescription credential created successfully');

        res.status(201).json({
          success: true,
          data: {
            prescriptionId: result.prescriptionCredential.credentialSubject.prescription.id,
            credentialId: result.prescriptionCredential.id,
            blockchainAnchor: result.blockchainAnchor,
            selectiveDisclosureEnabled: true
          },
          message: 'Prescription credential created with BBS+ selective disclosure'
        } as ApiResponse);

      } catch (error) {
        console.error('[FraudPreventionRoutes] Error creating prescription:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to create prescription credential',
          details: error.message
        } as ApiError);
      }
    })
  );

  /**
   * POST /fraud-prevention/prescription/verify
   * Pharmacy verifies prescription credential using selective disclosure
   */
  router.post('/prescription/verify',
    ValidationMiddleware.requireFields(['pharmacyDid', 'prescriptionCredentialId']),
    ErrorMiddleware.asyncHandler(async (req: QuarkIdRequest, res: Response) => {
      try {
        console.log('[FraudPreventionRoutes] Verifying prescription for pharmacy');

        const { pharmacyDid, prescriptionCredentialId } = req.body;
        
        const fraudPreventionService = req.fraudPreventionService;
        if (!fraudPreventionService) {
          return res.status(503).json({
            success: false,
            error: 'Fraud prevention service not available'
          } as ApiError);
        }

        // Get the prescription credential and create pharmacy-specific disclosure
        const kmsClient = req.kmsClient; // Assume KMS client is available in request
        const vcTokenService = req.vcTokenService;
        
        if (!kmsClient || !vcTokenService) {
          return res.status(503).json({
            success: false,
            error: 'Required services not available'
          } as ApiError);
        }

        const prescriptionToken = await vcTokenService.getVCToken(prescriptionCredentialId);
        if (!prescriptionToken) {
          return res.status(404).json({
            success: false,
            error: 'Prescription credential not found'
          } as ApiError);
        }

        // Create pharmacy-specific selective disclosure
        const { DISCLOSURE_FRAMES } = await import('../services/InsuranceFraudPreventionService');
        const pharmacyDisclosure = await kmsClient.deriveVC({
          vc: prescriptionToken.vc,
          frame: DISCLOSURE_FRAMES.pharmacy
        });

        res.json({
          success: true,
          data: {
            prescriptionDetails: pharmacyDisclosure,
            canDispense: prescriptionToken.vc.credentialSubject.prescription.status === 'active',
            validUntil: prescriptionToken.vc.credentialSubject.prescription.validUntil
          },
          message: 'Prescription verified for pharmacy'
        } as ApiResponse);

      } catch (error) {
        console.error('[FraudPreventionRoutes] Error verifying prescription:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to verify prescription',
          details: error.message
        } as ApiError);
      }
    })
  );

  /**
   * POST /fraud-prevention/dispensing/create
   * Pharmacy generates dispensing proof after medication is dispensed
   */
  router.post('/dispensing/create',
    ValidationMiddleware.requireFields(['pharmacyDid', 'prescriptionCredentialId', 'dispensingData', 'patientConfirmation']),
    ErrorMiddleware.asyncHandler(async (req: QuarkIdRequest, res: Response) => {
      try {
        console.log('[FraudPreventionRoutes] Creating dispensing proof');

        const { pharmacyDid, prescriptionCredentialId, dispensingData, patientConfirmation } = req.body;
        
        const fraudPreventionService = req.fraudPreventionService;
        if (!fraudPreventionService) {
          return res.status(503).json({
            success: false,
            error: 'Fraud prevention service not available'
          } as ApiError);
        }

        // Validate dispensing data
        const requiredDispensingFields = ['batchNumber', 'expirationDate', 'quantityDispensed', 'pharmacyName', 'pharmacistLicense'];
        const missingFields = requiredDispensingFields.filter(field => !dispensingData[field]);
        if (missingFields.length > 0) {
          return res.status(400).json({
            success: false,
            error: `Missing dispensing fields: ${missingFields.join(', ')}`
          } as ApiError);
        }

        const result = await fraudPreventionService.generateDispensingProof({
          pharmacyDid,
          prescriptionCredentialId,
          dispensingData,
          patientConfirmation: Boolean(patientConfirmation)
        });

        console.log('[FraudPreventionRoutes] Dispensing proof created successfully');

        res.status(201).json({
          success: true,
          data: {
            dispensingCredentialId: result.dispensingCredential.id,
            fraudScore: result.fraudScore,
            fraudRisk: result.fraudScore >= 50 ? 'high' : result.fraudScore >= 25 ? 'medium' : 'low'
          },
          message: 'Dispensing proof created successfully'
        } as ApiResponse);

      } catch (error) {
        console.error('[FraudPreventionRoutes] Error creating dispensing proof:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to create dispensing proof',
          details: error.message
        } as ApiError);
      }
    })
  );

  /**
   * POST /fraud-prevention/insurance/verify
   * Insurance company verifies claim using minimal selective disclosure
   */
  router.post('/insurance/verify',
    ValidationMiddleware.requireFields(['insurerDid', 'prescriptionCredentialId', 'dispensingCredentialId']),
    ErrorMiddleware.asyncHandler(async (req: QuarkIdRequest, res: Response) => {
      try {
        console.log('[FraudPreventionRoutes] Verifying insurance claim');

        const { insurerDid, prescriptionCredentialId, dispensingCredentialId, claimAmount } = req.body;
        
        const fraudPreventionService = req.fraudPreventionService;
        if (!fraudPreventionService) {
          return res.status(503).json({
            success: false,
            error: 'Fraud prevention service not available'
          } as ApiError);
        }

        const verificationProof = await fraudPreventionService.verifyInsuranceClaim({
          insurerDid,
          prescriptionCredentialId,
          dispensingCredentialId,
          claimAmount
        });

        // Determine claim approval based on fraud score
        const approved = verificationProof.fraudScore < 50 && 
                        verificationProof.prescriptionExists && 
                        verificationProof.medicationDispensed &&
                        verificationProof.patientConfirmed;

        console.log(`[FraudPreventionRoutes] Insurance verification completed: ${approved ? 'APPROVED' : 'DENIED'}`);

        res.json({
          success: true,
          data: {
            claimApproved: approved,
            fraudScore: verificationProof.fraudScore,
            fraudRisk: verificationProof.fraudScore >= 50 ? 'high' : verificationProof.fraudScore >= 25 ? 'medium' : 'low',
            verification: {
              prescriptionExists: verificationProof.prescriptionExists,
              medicationDispensed: verificationProof.medicationDispensed,
              doctorAuthorized: verificationProof.doctorAuthorized,
              pharmacyAuthorized: verificationProof.pharmacyAuthorized,
              patientConfirmed: verificationProof.patientConfirmed
            },
            proofHash: verificationProof.proofHash,
            verificationTimestamp: verificationProof.verificationTimestamp
          },
          message: `Insurance claim ${approved ? 'approved' : 'denied'} based on fraud prevention analysis`
        } as ApiResponse);

      } catch (error) {
        console.error('[FraudPreventionRoutes] Error verifying insurance claim:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to verify insurance claim',
          details: error.message
        } as ApiError);
      }
    })
  );

  /**
   * GET /fraud-prevention/prescription/:id/disclosure
   * Get selective disclosure of prescription for different actor types
   */
  router.get('/prescription/:id/disclosure',
    ValidationMiddleware.requireParams(['id']),
    ErrorMiddleware.asyncHandler(async (req: QuarkIdRequest, res: Response) => {
      try {
        const { id } = req.params;
        const { actorType, requestorDid } = req.query;

        console.log(`[FraudPreventionRoutes] Getting disclosure for actor type: ${actorType}`);

        const kmsClient = req.kmsClient;
        const vcTokenService = req.vcTokenService;
        
        if (!kmsClient || !vcTokenService) {
          return res.status(503).json({
            success: false,
            error: 'Required services not available'
          } as ApiError);
        }

        const prescriptionToken = await vcTokenService.getVCToken(id);
        if (!prescriptionToken) {
          return res.status(404).json({
            success: false,
            error: 'Prescription credential not found'
          } as ApiError);
        }

        // Select appropriate disclosure frame based on actor type
        const { DISCLOSURE_FRAMES } = await import('../services/InsuranceFraudPreventionService');
        let frame;
        
        switch (actorType) {
          case 'insurance':
            frame = DISCLOSURE_FRAMES.insurance;
            break;
          case 'pharmacy':
            frame = DISCLOSURE_FRAMES.pharmacy;
            break;
          case 'audit':
            frame = DISCLOSURE_FRAMES.audit;
            break;
          default:
            return res.status(400).json({
              success: false,
              error: 'Invalid actor type. Must be: insurance, pharmacy, or audit'
            } as ApiError);
        }

        const disclosure = await kmsClient.deriveVC({
          vc: prescriptionToken.vc,
          frame
        });

        res.json({
          success: true,
          data: {
            disclosure,
            actorType,
            requestTimestamp: new Date().toISOString()
          },
          message: `Selective disclosure created for ${actorType}`
        } as ApiResponse);

      } catch (error) {
        console.error('[FraudPreventionRoutes] Error creating disclosure:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to create selective disclosure',
          details: error.message
        } as ApiError);
      }
    })
  );

  /**
   * GET /fraud-prevention/statistics
   * Get fraud prevention system statistics (for system administrators)
   */
  router.get('/statistics',
    ErrorMiddleware.asyncHandler(async (req: QuarkIdRequest, res: Response) => {
      try {
        console.log('[FraudPreventionRoutes] Getting fraud prevention statistics');

        const fraudPreventionService = req.fraudPreventionService;
        if (!fraudPreventionService) {
          return res.status(503).json({
            success: false,
            error: 'Fraud prevention service not available'
          } as ApiError);
        }

        const statistics = await fraudPreventionService.getStatistics();

        res.json({
          success: true,
          data: statistics,
          message: 'Fraud prevention statistics retrieved'
        } as ApiResponse);

      } catch (error) {
        console.error('[FraudPreventionRoutes] Error getting statistics:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to retrieve statistics',
          details: error.message
        } as ApiError);
      }
    })
  );

  /**
   * POST /fraud-prevention/audit/full-disclosure
   * Auditor requests full disclosure with proper authorization
   */
  router.post('/audit/full-disclosure',
    ValidationMiddleware.requireFields(['auditorDid', 'prescriptionCredentialId', 'auditReason', 'authorizationToken']),
    ErrorMiddleware.asyncHandler(async (req: QuarkIdRequest, res: Response) => {
      try {
        console.log('[FraudPreventionRoutes] Processing audit full disclosure request');

        const { auditorDid, prescriptionCredentialId, auditReason, authorizationToken } = req.body;
        
        // In production, verify auditor authorization token
        // This would check against a registry of authorized auditors
        
        const kmsClient = req.kmsClient;
        const vcTokenService = req.vcTokenService;
        
        if (!kmsClient || !vcTokenService) {
          return res.status(503).json({
            success: false,
            error: 'Required services not available'
          } as ApiError);
        }

        const prescriptionToken = await vcTokenService.getVCToken(prescriptionCredentialId);
        if (!prescriptionToken) {
          return res.status(404).json({
            success: false,
            error: 'Prescription credential not found'
          } as ApiError);
        }

        // Create full disclosure for audit purposes
        const { DISCLOSURE_FRAMES } = await import('../services/InsuranceFraudPreventionService');
        const fullDisclosure = await kmsClient.deriveVC({
          vc: prescriptionToken.vc,
          frame: DISCLOSURE_FRAMES.audit
        });

        // Log audit access for compliance
        console.log(`[AUDIT] Full disclosure accessed by ${auditorDid} for prescription ${prescriptionCredentialId}. Reason: ${auditReason}`);

        res.json({
          success: true,
          data: {
            fullDisclosure,
            auditTrail: {
              auditorDid,
              accessTimestamp: new Date().toISOString(),
              reason: auditReason,
              prescriptionId: prescriptionToken.vc.credentialSubject.prescription.id
            }
          },
          message: 'Full disclosure provided for audit purposes'
        } as ApiResponse);

      } catch (error) {
        console.error('[FraudPreventionRoutes] Error processing audit request:', error);
        res.status(500).json({
          success: false,
          error: 'Failed to process audit request',
          details: error.message
        } as ApiError);
      }
    })
  );

  return router;
}

/**
 * Middleware to add fraud prevention service to request object
 */
export const addFraudPreventionService = (fraudPreventionService: InsuranceFraudPreventionService) => {
  return (req: QuarkIdRequest, res: Response, next: Function) => {
    req.fraudPreventionService = fraudPreventionService;
    next();
  };
};

/**
 * Role-based access control middleware for different actor types
 */
export const requireActorRole = (allowedRoles: string[]) => {
  return (req: QuarkIdRequest, res: Response, next: Function) => {
    const { actorRole, actorDid } = req.headers;
    
    if (!actorRole || !allowedRoles.includes(actorRole as string)) {
      return res.status(403).json({
        success: false,
        error: `Access denied. Required roles: ${allowedRoles.join(', ')}`
      } as ApiError);
    }
    
    req.actorRole = actorRole as string;
    req.actorDid = actorDid as string;
    next();
  };
};