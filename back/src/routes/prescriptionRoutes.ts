import { Router, Request, Response } from 'express';
import { PrescriptionService } from '../services/prescriptionService';
import { WalletClient } from '@bsv/sdk';
import { Db } from 'mongodb';

// Extend Request interface to include our custom properties
interface CustomRequest extends Request {
  walletClient?: WalletClient;
  db?: Db;
  prescriptionService?: PrescriptionService;
  quarkIdAgentService?: any;
  body: any;
  params: any;
  query: any;
}

/**
 * Create prescription-related routes
 */
export function createPrescriptionRoutes(): Router {
  const router = Router();
  
  console.log('[PrescriptionRoutes] Creating prescription routes...');
  
  // Initialize prescription service (in production, this would use dependency injection)
  let prescriptionService: PrescriptionService;

  // Middleware to initialize prescription service
  router.use((req: CustomRequest, res: Response, next) => {
    if (!prescriptionService && req.walletClient && req.quarkIdAgentService) {
      prescriptionService = new PrescriptionService(req.walletClient, req.quarkIdAgentService);
    }
    next();
  });

  /**
   * POST /prescriptions - Create a new prescription
   * Body: {
   *   doctorDid: string,
   *   patientDid: string,
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
        prescriptionData
      } = req.body;

      // Validate required fields
      if (!doctorDid || !patientDid || !prescriptionData) {
        return res.status(400).json({
          error: 'Missing required fields: doctorDid, patientDid, prescriptionData'
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

      // Create prescription - the service will use the QuarkID agent for signing
      const result = await prescriptionService.createPrescription(
        doctorDid,
        patientDid,
        prescriptionData
      );

      // Store prescription in database for lookup
      if (req.db) {
        console.log('[PrescriptionRoutes] Database available, storing prescription...');
        try {
          const insertResult = await req.db.collection('prescriptions').insertOne({
            ...result.prescriptionVC,
            createdAt: new Date(),
            tokenTxid: result.token.txid
          });
          console.log('[PrescriptionRoutes] Prescription stored in database:', insertResult.insertedId);
        } catch (dbError) {
          console.error('[PrescriptionRoutes] Error storing prescription in database:', dbError);
        }
      } else {
        console.error('[PrescriptionRoutes] Database not available! Prescription not stored.');
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
        console.log('[PrescriptionRoutes] Database available, storing dispensation...');
        try {
          const insertResult = await req.db.collection('dispensations').insertOne({
            ...result.dispensationVC,
            createdAt: new Date(),
            tokenTxid: result.updatedToken.txid
          });
          console.log('[PrescriptionRoutes] Dispensation stored in database:', insertResult.insertedId);
        } catch (dbError) {
          console.error('[PrescriptionRoutes] Error storing dispensation in database:', dbError);
        }
      } else {
        console.error('[PrescriptionRoutes] Database not available! Dispensation not stored.');
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
        console.log('[PrescriptionRoutes] Database available, storing confirmation...');
        try {
          const insertResult = await req.db.collection('confirmations').insertOne({
            ...result.confirmationVC,
            createdAt: new Date(),
            tokenTxid: result.finalizedToken.txid
          });
          console.log('[PrescriptionRoutes] Confirmation stored in database:', insertResult.insertedId);
        } catch (dbError) {
          console.error('[PrescriptionRoutes] Error storing confirmation in database:', dbError);
        }
      } else {
        console.error('[PrescriptionRoutes] Database not available! Confirmation not stored.');
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

      console.log('[PrescriptionRoutes] GET /actor/:did - Query:', JSON.stringify(query));
      console.log('[PrescriptionRoutes] GET /actor/:did - Found prescriptions:', prescriptions.length);
      console.log('[PrescriptionRoutes] GET /actor/:did - First prescription:', prescriptions[0]);

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

  /**
   * POST /prescriptions/share - Share a prescription with a pharmacy
   * Body: {
   *   prescriptionId: string,
   *   patientDid: string,
   *   pharmacyDid: string
   * }
   */
  router.post('/share', async (req: CustomRequest, res: Response) => {
    console.log('[PrescriptionRoutes] POST /share - Handler called');
    console.log('[PrescriptionRoutes] POST /share - Body:', req.body);
    
    try {
      const { prescriptionId, patientDid, pharmacyDid } = req.body;

      // Validate required fields
      if (!prescriptionId || !patientDid || !pharmacyDid) {
        return res.status(400).json({
          error: 'Missing required fields: prescriptionId, patientDid, pharmacyDid'
        });
      }

      if (!req.db) {
        return res.status(503).json({
          error: 'Database not available'
        });
      }

      // Verify the prescription exists and belongs to the patient
      const prescription = await req.db
        .collection('prescriptions')
        .findOne({ id: prescriptionId,
          'credentialSubject.id': patientDid
        });

      if (!prescription) {
        return res.status(404).json({
          error: 'Prescription not found or does not belong to the patient'
        });
      }

      // Check if already shared with this pharmacy
      const existingShare = await req.db
        .collection('sharedPrescriptions')
        .findOne({
          prescriptionId: prescriptionId,
          pharmacyDid: pharmacyDid
        });

      if (existingShare) {
        return res.status(400).json({
          error: 'Prescription already shared with this pharmacy'
        });
      }

      // Create a shared prescription record
      const sharedPrescription = {
        prescriptionId: prescriptionId,
        prescription: prescription,
        patientDid: patientDid,
        pharmacyDid: pharmacyDid,
        sharedAt: new Date(),
        status: 'shared' // 'shared', 'viewed', 'dispensed'
      };

      if (req.db) {
        console.log('[PrescriptionRoutes] Database available, storing shared prescription...');
        try {
          const insertResult = await req.db.collection('sharedPrescriptions').insertOne(sharedPrescription);
          console.log('[PrescriptionRoutes] Shared prescription stored in database:', insertResult.insertedId);
        } catch (dbError) {
          console.error('[PrescriptionRoutes] Error storing shared prescription in database:', dbError);
        }
      } else {
        console.error('[PrescriptionRoutes] Database not available! Shared prescription not stored.');
      }

      console.log(`[PrescriptionRoutes] Prescription ${prescriptionId} shared with pharmacy ${pharmacyDid}`);

      res.status(201).json({
        success: true,
        data: sharedPrescription,
        message: 'Prescription shared successfully'
      });

    } catch (error) {
      console.error('[PrescriptionRoutes] Error sharing prescription:', error);
      res.status(500).json({
        error: 'Failed to share prescription',
        details: error.message
      });
    }
  });

  /**
   * POST /prescriptions/:prescriptionId/dispensations - Create a dispensation record
   * Body: {
   *   pharmacyDid: string,
   *   medicationProvided: string,
   *   batchNumber?: string,
   *   expiryDate?: string,
   *   pharmacistNotes?: string
   * }
   */
  router.post('/:prescriptionId/dispensations', async (req: CustomRequest, res: Response) => {
    console.log('[PrescriptionRoutes] POST /:prescriptionId/dispensations - Handler called');
    console.log('[PrescriptionRoutes] Params:', req.params);
    console.log('[PrescriptionRoutes] Body:', req.body);
    
    try {
      const { prescriptionId } = req.params;
      const { pharmacyDid, medicationProvided, batchNumber, expiryDate, pharmacistNotes } = req.body;

      // Validate required fields
      if (!prescriptionId || !pharmacyDid || !medicationProvided) {
        return res.status(400).json({
          error: 'Missing required fields: prescriptionId, pharmacyDid, medicationProvided'
        });
      }

      if (!req.db) {
        return res.status(503).json({
          error: 'Database not available'
        });
      }

      // Verify the prescription exists
      const prescription = await req.db
        .collection('prescriptions')
        .findOne({ id: prescriptionId });

      if (!prescription) {
        return res.status(404).json({
          error: 'Prescription not found'
        });
      }

      // Verify the prescription is shared with this pharmacy
      const sharedPrescription = await req.db
        .collection('sharedPrescriptions')
        .findOne({
          prescriptionId: prescriptionId,
          pharmacyDid: pharmacyDid
        });

      if (!sharedPrescription) {
        return res.status(403).json({
          error: 'Prescription not shared with this pharmacy'
        });
      }

      // Check if already dispensed
      const existingDispensation = await req.db
        .collection('dispensations')
        .findOne({
          prescriptionId: prescriptionId,
          pharmacyDid: pharmacyDid
        });

      if (existingDispensation) {
        return res.status(400).json({
          error: 'Prescription already dispensed by this pharmacy'
        });
      }

      // Create dispensation record
      const dispensation = {
        prescriptionId,
        pharmacyDid,
        patientDid: prescription.credentialSubject.id,
        medicationProvided,
        batchNumber: batchNumber || '',
        expiryDate: expiryDate || '',
        pharmacistNotes: pharmacistNotes || '',
        dispensedAt: new Date().toISOString(),
        status: 'dispensed'
      };

      const result = await req.db
        .collection('dispensations')
        .insertOne(dispensation);

      console.log('[PrescriptionRoutes] Dispensation created:', result.insertedId);

      res.status(201).json({
        success: true,
        dispensationId: result.insertedId,
        dispensation
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
   * GET /prescriptions/shared/:pharmacyDid - Get prescriptions shared with a pharmacy
   */
  router.get('/shared/:pharmacyDid', async (req: CustomRequest, res: Response) => {
    try {
      const pharmacyDid = req.params.pharmacyDid;

      if (!req.db) {
        return res.status(503).json({
          error: 'Database not available'
        });
      }

      const sharedPrescriptions = await req.db
        .collection('sharedPrescriptions')
        .find({ 
          pharmacyDid: pharmacyDid
        })
        .sort({ sharedAt: -1 })
        .toArray();

      // For each shared prescription, check if it has been dispensed
      const prescriptionsWithStatus = await Promise.all(
        sharedPrescriptions.map(async (shared) => {
          const dispensation = await req.db
            .collection('dispensations')
            .findOne({
              prescriptionId: shared.prescriptionId,
              pharmacyDid: pharmacyDid
            });

          return {
            ...shared,
            status: dispensation ? 'dispensed' : 'pending',
            dispensation: dispensation || null
          };
        })
      );

      res.json({
        success: true,
        data: prescriptionsWithStatus,
        count: prescriptionsWithStatus.length
      });

    } catch (error) {
      console.error('[PrescriptionRoutes] Error retrieving shared prescriptions:', error);
      res.status(500).json({
        error: 'Failed to retrieve shared prescriptions',
        details: error.message
      });
    }
  });

  /**
   * POST /prescriptions/:prescriptionId/confirmations - Patient confirms receipt of medication
   * Body: {
   *   patientDid: string,
   *   confirmationNotes?: string
   * }
   */
  router.post('/:prescriptionId/confirmations', async (req: CustomRequest, res: Response) => {
    try {
      const prescriptionId = req.params.prescriptionId;
      const { patientDid, confirmationNotes } = req.body;

      // Validate required fields
      if (!prescriptionId || !patientDid) {
        return res.status(400).json({
          error: 'Missing required fields: prescriptionId, patientDid'
        });
      }

      if (!req.db) {
        return res.status(503).json({
          error: 'Database not available'
        });
      }

      // Verify the prescription exists
      const prescription = await req.db
        .collection('prescriptions')
        .findOne({ id: prescriptionId });

      if (!prescription) {
        return res.status(404).json({
          error: 'Prescription not found'
        });
      }

      // Verify the patient is the owner of the prescription
      if (prescription.credentialSubject.id !== patientDid) {
        return res.status(403).json({
          error: 'Unauthorized: You can only confirm your own prescriptions'
        });
      }

      // Check if prescription has been dispensed
      const dispensation = await req.db
        .collection('dispensations')
        .findOne({ prescriptionId: prescriptionId });

      if (!dispensation) {
        return res.status(400).json({
          error: 'Cannot confirm prescription that has not been dispensed'
        });
      }

      // Check if already confirmed
      const existingConfirmation = await req.db
        .collection('confirmations')
        .findOne({ prescriptionId: prescriptionId });

      if (existingConfirmation) {
        return res.status(400).json({
          error: 'Prescription already confirmed'
        });
      }

      // Create confirmation record (Confirmacion VC)
      const confirmation = {
        prescriptionId,
        patientDid,
        pharmacyDid: dispensation.pharmacyDid,
        confirmationNotes: confirmationNotes || '',
        confirmedAt: new Date().toISOString(),
        dispensationId: dispensation._id,
        status: 'confirmed',
        // In production, this would be a full VC with signature
        type: 'ConfirmacionVC',
        vcData: {
          '@context': ['https://www.w3.org/2018/credentials/v1'],
          type: ['VerifiableCredential', 'PrescriptionConfirmationCredential'],
          issuer: patientDid,
          issuanceDate: new Date().toISOString(),
          credentialSubject: {
            id: patientDid,
            prescriptionId: prescriptionId,
            pharmacyDid: dispensation.pharmacyDid,
            confirmationTimestamp: new Date().toISOString(),
            dispensationId: dispensation._id.toString()
          }
        }
      };

      const result = await req.db
        .collection('confirmations')
        .insertOne(confirmation);

      console.log('[PrescriptionRoutes] Confirmation created:', result.insertedId);

      res.status(201).json({
        success: true,
        confirmationId: result.insertedId,
        confirmation
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
   * GET /prescriptions/dispensed/:patientDid - Get dispensed prescriptions for a patient
   */
  router.get('/dispensed/:patientDid', async (req: CustomRequest, res: Response) => {
    try {
      const patientDid = req.params.patientDid;

      if (!req.db) {
        return res.status(503).json({
          error: 'Database not available'
        });
      }

      // Get all prescriptions for the patient
      const prescriptions = await req.db
        .collection('prescriptions')
        .find({ 'credentialSubject.id': patientDid })
        .toArray();

      // For each prescription, check if it has been dispensed and confirmed
      const prescriptionsWithStatus = await Promise.all(
        prescriptions.map(async (prescription) => {
          const dispensation = await req.db
            .collection('dispensations')
            .findOne({ prescriptionId: prescription.id });

          const confirmation = await req.db
            .collection('confirmations')
            .findOne({ prescriptionId: prescription.id });

          return {
            ...prescription,
            status: confirmation ? 'confirmed' : (dispensation ? 'dispensed' : 'pending'),
            dispensation: dispensation || null,
            confirmation: confirmation || null
          };
        })
      );

      // Filter only dispensed prescriptions (dispensed or confirmed)
      const dispensedPrescriptions = prescriptionsWithStatus.filter(p => 
        p.status === 'dispensed' || p.status === 'confirmed'
      );

      res.json({
        success: true,
        data: dispensedPrescriptions,
        count: dispensedPrescriptions.length
      });

    } catch (error) {
      console.error('[PrescriptionRoutes] Error retrieving dispensed prescriptions:', error);
      res.status(500).json({
        error: 'Failed to retrieve dispensed prescriptions',
        details: error.message
      });
    }
  });

  /**
   * GET /prescriptions/insurance/:insuranceProviderName - Get prescriptions for an insurance provider
   * Gets all prescriptions where the insuranceProvider field matches
   */
  router.get('/insurance/:insuranceProviderName', async (req: CustomRequest, res: Response) => {
    try {
      const insuranceProviderName = decodeURIComponent(req.params.insuranceProviderName);

      if (!req.db) {
        return res.status(503).json({
          error: 'Database not available'
        });
      }

      // Get all prescriptions for this insurance provider
      const prescriptions = await req.db
        .collection('prescriptions')
        .find({ 'credentialSubject.prescription.insuranceProvider': insuranceProviderName })
        .sort({ issuanceDate: -1 })
        .toArray();

      // For each prescription, get dispensation and confirmation status
      const prescriptionsWithStatus = await Promise.all(
        prescriptions.map(async (prescription) => {
          const dispensation = await req.db
            .collection('dispensations')
            .findOne({ prescriptionId: prescription.id });

          const confirmation = await req.db
            .collection('confirmations')
            .findOne({ prescriptionId: prescription.id });

          // Get patient and doctor information
          const sharedInfo = await req.db
            .collection('sharedPrescriptions')
            .findOne({ prescriptionId: prescription.id });

          return {
            ...prescription,
            status: confirmation ? 'confirmed' : (dispensation ? 'dispensed' : 'active'),
            dispensation: dispensation || null,
            confirmation: confirmation || null,
            sharedWithPharmacy: sharedInfo ? sharedInfo.pharmacyDid : null,
            sharedAt: sharedInfo ? sharedInfo.sharedAt : null
          };
        })
      );

      res.json({
        success: true,
        insuranceProvider: insuranceProviderName,
        data: prescriptionsWithStatus,
        count: prescriptionsWithStatus.length,
        summary: {
          total: prescriptionsWithStatus.length,
          active: prescriptionsWithStatus.filter(p => p.status === 'active').length,
          dispensed: prescriptionsWithStatus.filter(p => p.status === 'dispensed').length,
          confirmed: prescriptionsWithStatus.filter(p => p.status === 'confirmed').length
        }
      });

    } catch (error) {
      console.error('[PrescriptionRoutes] Error retrieving insurance prescriptions:', error);
      res.status(500).json({
        error: 'Failed to retrieve prescriptions for insurance provider',
        details: error.message
      });
    }
  });

  /**
   * GET /prescriptions/insurance/:insuranceProviderName/stats - Get statistics for an insurance provider
   */
  router.get('/insurance/:insuranceProviderName/stats', async (req: CustomRequest, res: Response) => {
    try {
      const insuranceProviderName = decodeURIComponent(req.params.insuranceProviderName);

      if (!req.db) {
        return res.status(503).json({
          error: 'Database not available'
        });
      }

      // Get all prescriptions for this insurance provider
      const prescriptions = await req.db
        .collection('prescriptions')
        .find({ 'credentialSubject.prescription.insuranceProvider': insuranceProviderName })
        .toArray();

      // Calculate statistics
      const prescriptionIds = prescriptions.map(p => p.id);
      
      const dispensationsCount = await req.db
        .collection('dispensations')
        .countDocuments({ prescriptionId: { $in: prescriptionIds } });

      const confirmationsCount = await req.db
        .collection('confirmations')
        .countDocuments({ prescriptionId: { $in: prescriptionIds } });

      // Group by medication
      const medicationStats = prescriptions.reduce((acc, prescription) => {
        const med = prescription.credentialSubject.prescription.medication.name;
        if (!acc[med]) {
          acc[med] = 0;
        }
        acc[med]++;
        return acc;
      }, {} as Record<string, number>);

      // Group by month
      const monthlyStats = prescriptions.reduce((acc, prescription) => {
        const date = new Date(prescription.issuanceDate);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        if (!acc[monthKey]) {
          acc[monthKey] = 0;
        }
        acc[monthKey]++;
        return acc;
      }, {} as Record<string, number>);

      res.json({
        success: true,
        insuranceProvider: insuranceProviderName,
        statistics: {
          totalPrescriptions: prescriptions.length,
          dispensed: dispensationsCount,
          confirmed: confirmationsCount,
          pending: prescriptions.length - dispensationsCount,
          medicationBreakdown: medicationStats,
          monthlyBreakdown: monthlyStats
        }
      });

    } catch (error) {
      console.error('[PrescriptionRoutes] Error retrieving insurance statistics:', error);
      res.status(500).json({
        error: 'Failed to retrieve statistics for insurance provider',
        details: error.message
      });
    }
  });

  return router;
}