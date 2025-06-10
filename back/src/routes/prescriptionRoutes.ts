import { Router, Request, Response } from 'express';
import { PrescriptionService } from '../services/prescriptionService';
import { WalletClient } from '@bsv/sdk';
import { Db } from 'mongodb';

// Extend Request interface to include our custom properties
interface CustomRequest extends Request {
  walletClient?: WalletClient;
  db?: Db;
  prescriptionService?: PrescriptionService;
  body: any;
  params: any;
  query: any;
}

/**
 * Create prescription-related routes
 */
export function createPrescriptionRoutes(): Router {
  const router = Router();
  
  // Initialize prescription service (in production, this would use dependency injection)
  let prescriptionService: PrescriptionService;

  // Middleware to initialize prescription service
  router.use((req: CustomRequest, res: Response, next) => {
    if (!prescriptionService && req.walletClient) {
      prescriptionService = new PrescriptionService(req.walletClient);
    }
    next();
  });

  /**
   * POST /prescriptions - Create a new prescription
   * Body: {
   *   doctorDid: string,
   *   patientDid: string,
   *   doctorPrivateKey: string,
   *   prescriptionData: {
   *     patientName: string,
   *     patientId: string,
   *     patientAge: number,
   *     insuranceProvider?: string,
   *     diagnosis: string,
   *     medicationName: string,
   *     dosage: string,
   *     frequency: string,
   *     duration: string
   *   }
   * }
   */
  router.post('/', async (req: CustomRequest, res: Response) => {
    try {
      const {
        doctorDid,
        patientDid,
        doctorPrivateKey,
        prescriptionData
      } = req.body;

      // Validate required fields
      if (!doctorDid || !patientDid || !doctorPrivateKey || !prescriptionData) {
        return res.status(400).json({
          error: 'Missing required fields: doctorDid, patientDid, doctorPrivateKey, prescriptionData'
        });
      }

      // Validate prescription data
      const requiredPrescriptionFields = [
        'patientName', 'patientId', 'patientAge', 'diagnosis',
        'medicationName', 'dosage', 'frequency', 'duration'
      ];
      
      for (const field of requiredPrescriptionFields) {
        if (!prescriptionData[field]) {
          return res.status(400).json({
            error: `Missing required prescription field: ${field}`
          });
        }
      }

      if (!prescriptionService) {
        return res.status(503).json({
          error: 'Prescription service not available'
        });
      }

      // Create prescription
      const result = await prescriptionService.createPrescription(
        doctorDid,
        patientDid,
        prescriptionData,
        doctorPrivateKey
      );

      // Store prescription in database for lookup
      if (req.db) {
        await req.db.collection('prescriptions').insertOne({
          ...result.prescriptionVC,
          createdAt: new Date(),
          tokenTxid: result.token.txid
        });
      }

      console.log(`[PrescriptionRoutes] Prescription created: ${result.prescriptionVC.credentialSubject.prescription.id}`);

      res.status(201).json({
        success: true,
        data: {
          prescriptionVC: result.prescriptionVC,
          token: result.token,
          prescriptionId: result.prescriptionVC.credentialSubject.prescription.id
        },
        message: 'Prescription created successfully'
      });

    } catch (error) {
      console.error('[PrescriptionRoutes] Error creating prescription:', error);
      res.status(500).json({
        error: 'Failed to create prescription',
        details: error.message
      });
    }
  });

  /**
   * GET /prescriptions/:id - Get prescription details
   */
  router.get('/:id', async (req: CustomRequest, res: Response) => {
    try {
      const prescriptionId = req.params.id;

      if (!req.db) {
        return res.status(503).json({
          error: 'Database not available'
        });
      }

      // Query prescription from database
      const prescription = await req.db
        .collection('prescriptions')
        .findOne({ 
          'credentialSubject.prescription.id': prescriptionId 
        });

      if (!prescription) {
        return res.status(404).json({
          error: 'Prescription not found'
        });
      }

      // Also get associated dispensation and confirmation if they exist
      const dispensation = await req.db
        .collection('dispensations')
        .findOne({ 
          'credentialSubject.prescription.id': prescriptionId 
        });

      const confirmation = await req.db
        .collection('confirmations')
        .findOne({ 
          'credentialSubject.confirmation.prescriptionId': prescriptionId 
        });

      res.json({
        success: true,
        data: {
          prescription,
          dispensation,
          confirmation,
          status: confirmation ? 'confirmed' : (dispensation ? 'dispensed' : 'created')
        }
      });

    } catch (error) {
      console.error('[PrescriptionRoutes] Error retrieving prescription:', error);
      res.status(500).json({
        error: 'Failed to retrieve prescription',
        details: error.message
      });
    }
  });

  /**
   * POST /prescriptions/:id/dispense - Create dispensation for a prescription
   * Body: {
   *   pharmacyDid: string,
   *   pharmacistDid: string,
   *   pharmacyPrivateKey: string,
   *   dispensationData: {
   *     batchNumber: string,
   *     expirationDate: string,
   *     manufacturer: string
   *   }
   * }
   */
  router.post('/:id/dispense', async (req: CustomRequest, res: Response) => {
    try {
      const prescriptionId = req.params.id;
      const {
        pharmacyDid,
        pharmacistDid,
        pharmacyPrivateKey,
        dispensationData
      } = req.body;

      // Validate required fields
      if (!pharmacyDid || !pharmacistDid || !pharmacyPrivateKey || !dispensationData) {
        return res.status(400).json({
          error: 'Missing required fields: pharmacyDid, pharmacistDid, pharmacyPrivateKey, dispensationData'
        });
      }

      // Validate dispensation data
      const requiredDispensationFields = ['batchNumber', 'expirationDate', 'manufacturer'];
      for (const field of requiredDispensationFields) {
        if (!dispensationData[field]) {
          return res.status(400).json({
            error: `Missing required dispensation field: ${field}`
          });
        }
      }

      if (!prescriptionService) {
        return res.status(503).json({
          error: 'Prescription service not available'
        });
      }

      // Create dispensation
      const result = await prescriptionService.createDispensation(
        pharmacyDid,
        pharmacistDid,
        prescriptionId,
        dispensationData,
        pharmacyPrivateKey
      );

      // Store dispensation in database
      if (req.db) {
        await req.db.collection('dispensations').insertOne({
          ...result.dispensationVC,
          createdAt: new Date(),
          tokenTxid: result.updatedToken.txid
        });
      }

      console.log(`[PrescriptionRoutes] Dispensation created for prescription: ${prescriptionId}`);

      res.status(201).json({
        success: true,
        data: {
          dispensationVC: result.dispensationVC,
          updatedToken: result.updatedToken
        },
        message: 'Dispensation created successfully'
      });

    } catch (error) {
      console.error('[PrescriptionRoutes] Error creating dispensation:', error);
      res.status(500).json({
        error: 'Failed to create dispensation',
        details: error.message
      });
    }
  });

  /**
   * POST /prescriptions/:id/confirm - Create confirmation for a prescription
   * Body: {
   *   patientDid: string,
   *   patientPrivateKey: string,
   *   confirmationData: {
   *     notes?: string
   *   }
   * }
   */
  router.post('/:id/confirm', async (req: CustomRequest, res: Response) => {
    try {
      const prescriptionId = req.params.id;
      const {
        patientDid,
        patientPrivateKey,
        confirmationData = {}
      } = req.body;

      // Validate required fields
      if (!patientDid || !patientPrivateKey) {
        return res.status(400).json({
          error: 'Missing required fields: patientDid, patientPrivateKey'
        });
      }

      if (!prescriptionService) {
        return res.status(503).json({
          error: 'Prescription service not available'
        });
      }

      // Create confirmation
      const result = await prescriptionService.createConfirmation(
        patientDid,
        prescriptionId,
        confirmationData,
        patientPrivateKey
      );

      // Store confirmation in database
      if (req.db) {
        await req.db.collection('confirmations').insertOne({
          ...result.confirmationVC,
          createdAt: new Date(),
          tokenTxid: result.finalizedToken.txid
        });
      }

      console.log(`[PrescriptionRoutes] Confirmation created for prescription: ${prescriptionId}`);

      res.status(201).json({
        success: true,
        data: {
          confirmationVC: result.confirmationVC,
          finalizedToken: result.finalizedToken
        },
        message: 'Confirmation created successfully'
      });

    } catch (error) {
      console.error('[PrescriptionRoutes] Error creating confirmation:', error);
      res.status(500).json({
        error: 'Failed to create confirmation',
        details: error.message
      });
    }
  });

  /**
   * GET /prescriptions/actor/:did - Get all prescriptions for a specific actor
   */
  router.get('/actor/:did', async (req: CustomRequest, res: Response) => {
    try {
      const actorDid = req.params.did;
      const { role } = req.query; // 'patient', 'doctor', or 'pharmacy'

      if (!req.db) {
        return res.status(503).json({
          error: 'Database not available'
        });
      }

      let query: any = {};

      // Build query based on actor role
      switch (role) {
        case 'patient':
          query = { 'credentialSubject.id': actorDid };
          break;
        case 'doctor':
          query = { 'issuer': actorDid };
          break;
        case 'pharmacy':
          // For pharmacy, we need to look in dispensations
          const dispensations = await req.db
            .collection('dispensations')
            .find({ 'issuer': actorDid })
            .toArray();
          
          const prescriptionIds = dispensations.map(d => 
            d.credentialSubject.prescription.id
          );
          
          query = { 
            'credentialSubject.prescription.id': { $in: prescriptionIds }
          };
          break;
        default:
          // Return all prescriptions involving this DID
          query = {
            $or: [
              { 'credentialSubject.id': actorDid },
              { 'issuer': actorDid }
            ]
          };
      }

      const prescriptions = await req.db
        .collection('prescriptions')
        .find(query)
        .sort({ createdAt: -1 })
        .toArray();

      res.json({
        success: true,
        data: prescriptions,
        count: prescriptions.length
      });

    } catch (error) {
      console.error('[PrescriptionRoutes] Error retrieving actor prescriptions:', error);
      res.status(500).json({
        error: 'Failed to retrieve prescriptions',
        details: error.message
      });
    }
  });

  /**
   * GET /prescriptions/status/:status - Get prescriptions by status
   */
  router.get('/status/:status', async (req: CustomRequest, res: Response) => {
    try {
      const status = req.params.status; // 'no dispensado' or 'dispensado'

      if (!req.db) {
        return res.status(503).json({
          error: 'Database not available'
        });
      }

      const prescriptions = await req.db
        .collection('prescriptions')
        .find({ 
          'credentialSubject.prescription.status': status 
        })
        .sort({ createdAt: -1 })
        .toArray();

      res.json({
        success: true,
        data: prescriptions,
        count: prescriptions.length
      });

    } catch (error) {
      console.error('[PrescriptionRoutes] Error retrieving prescriptions by status:', error);
      res.status(500).json({
        error: 'Failed to retrieve prescriptions',
        details: error.message
      });
    }
  });

  return router;
}