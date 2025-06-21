import express from 'express';
import { Router, Request, Response } from 'express';
import { WalletClient } from '@bsv/sdk';
import { Db } from 'mongodb';
import { PrescriptionTokenService } from '../services/prescriptionTokenService.js';

const router = express.Router();

// Extend Request interface to include our custom properties
interface CustomRequest extends Request {
  walletClient?: WalletClient;
  db?: Db;
  prescriptionTokenService?: PrescriptionTokenService;
  quarkIdAgentService?: any;
  body: any;
  params: any;
  query: any;
}

/**
 * Enhanced prescription routes using BSV overlay tokens and VCs
 */

/**
 * @route POST /api/prescriptions
 * @desc Create new prescription with BSV token and VCs
 */
router.post('/', async (req: CustomRequest, res) => {
  try {
    if (!req.db) {
      return res.status(500).json({ error: 'Database connection not available' });
    }

    if (!req.walletClient) {
      return res.status(500).json({ error: 'Wallet client not available' });
    }

    if (!req.quarkIdAgentService) {
      return res.status(500).json({ error: 'QuarkID Agent service not available' });
    }

    const {
      patientDid,
      doctorDid,
      medicationName,
      dosage,
      quantity,
      instructions,
      diagnosisCode,
      insuranceDid,
      expiryHours
    } = req.body;

    // Validate required fields
    if (!patientDid || !doctorDid || !medicationName || !dosage || !quantity || !instructions) {
      return res.status(400).json({ 
        error: 'patientDid, doctorDid, medicationName, dosage, quantity, and instructions are required' 
      });
    }

    // Create prescription token service
    const tokenService = new PrescriptionTokenService(
      req.db,
      req.walletClient,
      {
        endpoint: process.env.BSV_OVERLAY_ENDPOINT || 'https://overlay.quarkid.org',
        topic: process.env.BSV_OVERLAY_TOPIC || 'prescription-tokens'
      },
      req.quarkIdAgentService
    );

    const prescriptionData = {
      patientDid,
      doctorDid,
      medicationName,
      dosage,
      quantity: parseInt(quantity),
      instructions,
      diagnosisCode,
      insuranceDid,
      expiryHours: expiryHours ? parseInt(expiryHours) : 720 // 30 days default
    };

    const token = await tokenService.createPrescriptionToken(prescriptionData);

    res.status(201).json({
      success: true,
      message: 'Prescription token created successfully with BSV overlay and VCs',
      data: token
    });

  } catch (error) {
    console.error('Error creating prescription:', error);
    res.status(500).json({
      error: 'Failed to create prescription',
      details: error.message
    });
  }
});

/**
 * @route GET /api/prescriptions/:tokenId
 * @desc Get prescription token by ID
 */
router.get('/:tokenId', async (req: CustomRequest, res) => {
  try {
    if (!req.db) {
      return res.status(500).json({ error: 'Database connection not available' });
    }

    if (!req.walletClient) {
      return res.status(500).json({ error: 'Wallet client not available' });
    }

    if (!req.quarkIdAgentService) {
      return res.status(500).json({ error: 'QuarkID Agent service not available' });
    }

    const { tokenId } = req.params;
    const tokenService = new PrescriptionTokenService(req.db, req.walletClient, {
      endpoint: process.env.BSV_OVERLAY_ENDPOINT || 'https://overlay.quarkid.org',
      topic: process.env.BSV_OVERLAY_TOPIC || 'prescription-tokens'
    }, req.quarkIdAgentService);

    const token = await tokenService.getToken(tokenId);

    if (!token) {
      return res.status(404).json({ error: 'Prescription token not found' });
    }

    res.json({
      success: true,
      data: token
    });

  } catch (error) {
    console.error('Error fetching prescription:', error);
    res.status(500).json({
      error: 'Failed to fetch prescription',
      details: error.message
    });
  }
});

/**
 * @route GET /api/prescriptions/patient/:patientDid
 * @desc Get prescriptions by patient DID
 */
router.get('/patient/:patientDid', async (req: CustomRequest, res) => {
  try {
    if (!req.db) {
      return res.status(500).json({ error: 'Database connection not available' });
    }

    if (!req.walletClient) {
      return res.status(500).json({ error: 'Wallet client not available' });
    }

    if (!req.quarkIdAgentService) {
      return res.status(500).json({ error: 'QuarkID Agent service not available' });
    }

    const { patientDid } = req.params;
    const decodedDid = decodeURIComponent(patientDid);
    
    const tokenService = new PrescriptionTokenService(req.db, req.walletClient, {
      endpoint: process.env.BSV_OVERLAY_ENDPOINT || 'https://overlay.quarkid.org',
      topic: process.env.BSV_OVERLAY_TOPIC || 'prescription-tokens'
    }, req.quarkIdAgentService);

    const tokens = await tokenService.getTokensByPatient(decodedDid);

    res.json({
      success: true,
      data: tokens,
      count: tokens.length
    });

  } catch (error) {
    console.error('Error fetching prescriptions by patient:', error);
    res.status(500).json({
      error: 'Failed to fetch prescriptions by patient',
      details: error.message
    });
  }
});

/**
 * @route GET /api/prescriptions/doctor/:doctorDid
 * @desc Get prescriptions by doctor DID
 */
router.get('/doctor/:doctorDid', async (req: CustomRequest, res) => {
  try {
    if (!req.db) {
      return res.status(500).json({ error: 'Database connection not available' });
    }

    if (!req.walletClient) {
      return res.status(500).json({ error: 'Wallet client not available' });
    }

    if (!req.quarkIdAgentService) {
      return res.status(500).json({ error: 'QuarkID Agent service not available' });
    }

    const { doctorDid } = req.params;
    const decodedDid = decodeURIComponent(doctorDid);
    
    const tokenService = new PrescriptionTokenService(req.db, req.walletClient, {
      endpoint: process.env.BSV_OVERLAY_ENDPOINT || 'https://overlay.quarkid.org',
      topic: process.env.BSV_OVERLAY_TOPIC || 'prescription-tokens'
    }, req.quarkIdAgentService);

    const tokens = await tokenService.getTokensByDoctor(decodedDid);

    res.json({
      success: true,
      data: tokens,
      count: tokens.length
    });

  } catch (error) {
    console.error('Error fetching prescriptions by doctor:', error);
    res.status(500).json({
      error: 'Failed to fetch prescriptions by doctor',
      details: error.message
    });
  }
});

/**
 * @route GET /api/prescriptions/pharmacy/:pharmacyDid
 * @desc Get prescriptions by pharmacy DID
 */
router.get('/pharmacy/:pharmacyDid', async (req: CustomRequest, res) => {
  try {
    if (!req.db) {
      return res.status(500).json({ error: 'Database connection not available' });
    }

    if (!req.walletClient) {
      return res.status(500).json({ error: 'Wallet client not available' });
    }

    if (!req.quarkIdAgentService) {
      return res.status(500).json({ error: 'QuarkID Agent service not available' });
    }

    const { pharmacyDid } = req.params;
    const decodedDid = decodeURIComponent(pharmacyDid);
    
    const tokenService = new PrescriptionTokenService(req.db, req.walletClient, {
      endpoint: process.env.BSV_OVERLAY_ENDPOINT || 'https://overlay.quarkid.org',
      topic: process.env.BSV_OVERLAY_TOPIC || 'prescription-tokens'
    }, req.quarkIdAgentService);

    const tokens = await tokenService.getTokensByPharmacy(decodedDid);

    res.json({
      success: true,
      data: tokens,
      count: tokens.length
    });

  } catch (error) {
    console.error('Error fetching prescriptions by pharmacy:', error);
    res.status(500).json({
      error: 'Failed to fetch prescriptions by pharmacy',
      details: error.message
    });
  }
});

/**
 * @route GET /api/prescriptions/insurance/:insuranceDid
 * @desc Get prescriptions by insurance DID
 */
router.get('/insurance/:insuranceDid', async (req: CustomRequest, res) => {
  try {
    if (!req.db) {
      return res.status(500).json({ error: 'Database connection not available' });
    }

    if (!req.walletClient) {
      return res.status(500).json({ error: 'Wallet client not available' });
    }

    if (!req.quarkIdAgentService) {
      return res.status(500).json({ error: 'QuarkID Agent service not available' });
    }

    const { insuranceDid } = req.params;
    const tokenService = new PrescriptionTokenService(req.db, req.walletClient, {
      endpoint: process.env.BSV_OVERLAY_ENDPOINT || 'https://overlay.quarkid.org',
      topic: process.env.BSV_OVERLAY_TOPIC || 'prescription-tokens'
    }, req.quarkIdAgentService);

    const tokens = await tokenService.getTokensByInsurance(insuranceDid);

    res.json({
      success: true,
      data: tokens,
      count: tokens.length
    });

  } catch (error) {
    console.error('Error fetching prescriptions by insurance:', error);
    res.status(500).json({
      error: 'Failed to fetch prescriptions by insurance',
      details: error.message
    });
  }
});

/**
 * @route POST /api/prescriptions/share
 * @desc Share prescription token with a pharmacy
 */
router.post('/share', async (req: CustomRequest, res) => {
  try {
    if (!req.db) {
      return res.status(500).json({ error: 'Database connection not available' });
    }

    if (!req.walletClient) {
      return res.status(500).json({ error: 'Wallet client not available' });
    }

    if (!req.quarkIdAgentService) {
      return res.status(500).json({ error: 'QuarkID Agent service not available' });
    }

    const { prescriptionId, patientDid, pharmacyDid } = req.body;

    // Validate required fields
    if (!prescriptionId || !patientDid || !pharmacyDid) {
      return res.status(400).json({ 
        error: 'prescriptionId, patientDid, and pharmacyDid are required' 
      });
    }

    const tokenService = new PrescriptionTokenService(req.db, req.walletClient, {
      endpoint: process.env.BSV_OVERLAY_ENDPOINT || 'https://overlay.quarkid.org',
      topic: process.env.BSV_OVERLAY_TOPIC || 'prescription-tokens'
    }, req.quarkIdAgentService);

    const updatedToken = await tokenService.sharePrescriptionToken(
      prescriptionId,
      patientDid,
      pharmacyDid
    );

    res.json({
      success: true,
      message: 'Prescription shared successfully',
      data: updatedToken
    });

  } catch (error) {
    console.error('Error sharing prescription:', error);
    res.status(500).json({
      error: 'Failed to share prescription',
      details: error.message
    });
  }
});

/**
 * @route POST /api/prescriptions/:tokenId/dispense
 * @desc Dispense prescription at pharmacy
 */
router.post('/:tokenId/dispense', async (req: CustomRequest, res) => {
  try {
    if (!req.db) {
      return res.status(500).json({ error: 'Database connection not available' });
    }

    if (!req.walletClient) {
      return res.status(500).json({ error: 'Wallet client not available' });
    }

    if (!req.quarkIdAgentService) {
      return res.status(500).json({ error: 'QuarkID Agent service not available' });
    }

    const { tokenId } = req.params;
    const {
      pharmacyDid,
      batchNumber,
      manufacturerInfo,
      dispensedQuantity,
      pharmacistSignature
    } = req.body;

    // Validate required fields
    if (!pharmacyDid || !batchNumber || !manufacturerInfo || !dispensedQuantity || !pharmacistSignature) {
      return res.status(400).json({ 
        error: 'pharmacyDid, batchNumber, manufacturerInfo, dispensedQuantity, and pharmacistSignature are required' 
      });
    }

    const tokenService = new PrescriptionTokenService(req.db, req.walletClient, {
      endpoint: process.env.BSV_OVERLAY_ENDPOINT || 'https://overlay.quarkid.org',
      topic: process.env.BSV_OVERLAY_TOPIC || 'prescription-tokens'
    }, req.quarkIdAgentService);

    const dispensationData = {
      batchNumber,
      manufacturerInfo,
      dispensedQuantity: parseInt(dispensedQuantity),
      dispensedDate: new Date(),
      pharmacistSignature
    };

    const updatedToken = await tokenService.dispensePrescription(tokenId, pharmacyDid, dispensationData);

    res.json({
      success: true,
      message: 'Prescription dispensed successfully with dispensation VC',
      data: updatedToken
    });

  } catch (error) {
    console.error('Error dispensing prescription:', error);
    res.status(500).json({
      error: 'Failed to dispense prescription',
      details: error.message
    });
  }
});

/**
 * @route POST /api/prescriptions/:tokenId/confirm
 * @desc Confirm prescription receipt by patient
 */
router.post('/:tokenId/confirm', async (req: CustomRequest, res) => {
  try {
    if (!req.db) {
      return res.status(500).json({ error: 'Database connection not available' });
    }

    if (!req.walletClient) {
      return res.status(500).json({ error: 'Wallet client not available' });
    }

    if (!req.quarkIdAgentService) {
      return res.status(500).json({ error: 'QuarkID Agent service not available' });
    }

    const { tokenId } = req.params;
    const { patientSignature } = req.body;

    // Validate required fields
    if (!patientSignature) {
      return res.status(400).json({ 
        error: 'patientSignature is required' 
      });
    }

    const tokenService = new PrescriptionTokenService(req.db, req.walletClient, {
      endpoint: process.env.BSV_OVERLAY_ENDPOINT || 'https://overlay.quarkid.org',
      topic: process.env.BSV_OVERLAY_TOPIC || 'prescription-tokens'
    }, req.quarkIdAgentService);

    const updatedToken = await tokenService.confirmPrescriptionReceipt(tokenId, patientSignature);

    res.json({
      success: true,
      message: 'Prescription receipt confirmed successfully with confirmation VC',
      data: updatedToken
    });

  } catch (error) {
    console.error('Error confirming prescription:', error);
    res.status(500).json({
      error: 'Failed to confirm prescription',
      details: error.message
    });
  }
});

/**
 * @route GET /api/prescriptions/status/:status
 * @desc Get prescriptions by status
 */
router.get('/status/:status', async (req: CustomRequest, res) => {
  try {
    if (!req.db) {
      return res.status(500).json({ error: 'Database connection not available' });
    }

    const { status } = req.params;
    
    if (!['created', 'dispensing', 'dispensed', 'confirmed', 'expired'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const tokensCollection = req.db.collection('prescription_tokens');
    const tokens = await tokensCollection.find({ status: status }).toArray();

    res.json({
      success: true,
      data: tokens,
      count: tokens.length
    });

  } catch (error) {
    console.error('Error fetching prescriptions by status:', error);
    res.status(500).json({
      error: 'Failed to fetch prescriptions by status',
      details: error.message
    });
  }
});

export default router;
