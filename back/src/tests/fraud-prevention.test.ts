import { describe, beforeAll, afterAll, beforeEach, test, expect, jest } from '@jest/globals';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongoClient, Db } from 'mongodb';
import { PrivateKey, WalletClient } from '@bsv/sdk';
import { KMSClient } from '@quarkid/kms-client';
import { Suite, LANG } from '@quarkid/kms-core';
import { InsuranceFraudPreventionService, DISCLOSURE_FRAMES } from '../services/InsuranceFraudPreventionService';
import { VCTokenService } from '../services/vcTokenService';
import { QuarkIdAgentService } from '../services/quarkIdAgentService';

/**
 * Comprehensive test suite for Insurance Fraud Prevention using BBS+ ZKPs
 * 
 * Tests cover:
 * - Prescription credential creation with BBS+ signatures
 * - Selective disclosure for different actor types
 * - Dispensing proof generation and verification
 * - Insurance claim verification with fraud detection
 * - Fraud scenario testing
 * - Performance benchmarks
 */

describe('Insurance Fraud Prevention with BBS+ ZKPs', () => {
  let mongoServer: MongoMemoryServer;
  let mongoClient: MongoClient;
  let db: Db;
  let walletClient: WalletClient;
  let kmsClient: KMSClient;
  let vcTokenService: VCTokenService;
  let quarkIdAgentService: QuarkIdAgentService;
  let fraudPreventionService: InsuranceFraudPreventionService;

  // Test actors
  const testActors = {
    doctor: {
      did: 'did:test:doctor123',
      privateKey: PrivateKey.fromRandom(),
      info: {
        name: 'Dr. Alice Smith',
        licenseNumber: 'MD123456',
        specialization: 'General Practice'
      }
    },
    patient: {
      did: 'did:test:patient456',
      privateKey: PrivateKey.fromRandom(),
      info: {
        name: 'John Doe',
        birthDate: '1985-06-15',
        insuranceProvider: 'HealthCorp Insurance'
      }
    },
    pharmacy: {
      did: 'did:test:pharmacy789',
      privateKey: PrivateKey.fromRandom(),
      info: {
        name: 'MediCare Pharmacy',
        pharmacistLicense: 'PH987654'
      }
    },
    insurer: {
      did: 'did:test:insurer321',
      privateKey: PrivateKey.fromRandom(),
      info: {
        name: 'HealthCorp Insurance',
        policyNumber: 'HC-789456123'
      }
    }
  };

  beforeAll(async () => {
    // Setup in-memory MongoDB
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    mongoClient = new MongoClient(mongoUri);
    await mongoClient.connect();
    db = mongoClient.db('fraud_prevention_test');

    // Mock wallet client for testing
    walletClient = {
      createAction: jest.fn().mockImplementation(() => Promise.resolve({
        txid: 'mock_tx_' + Math.random().toString(36).substring(7),
        outputs: [{ satoshis: 1, lockingScript: 'mock_script' }]
      }))
    } as any;

    // Setup KMS client with BBS+ support
    const mockStorage = {
      add: jest.fn(),
      get: jest.fn(),
      getAll: jest.fn().mockImplementation(() => Promise.resolve([])),
      update: jest.fn(),
      remove: jest.fn()
    };

    kmsClient = new KMSClient({
      lang: LANG.en,
      storage: mockStorage as any,
      didResolver: mockDIDResolver as any,
      mobile: false // Enable BBS+ suite
    });

    // Setup services
    quarkIdAgentService = new QuarkIdAgentService({} as any); // Mock
    vcTokenService = new VCTokenService(db, walletClient, quarkIdAgentService);
    
    fraudPreventionService = new InsuranceFraudPreventionService(
      db,
      walletClient,
      kmsClient,
      vcTokenService,
      quarkIdAgentService,
      mockDIDResolver as any
    );
  });

  afterAll(async () => {
    await mongoClient.close();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    // Clear collections before each test
    await db.collection('vc_tokens').deleteMany({});
    await db.collection('fraud_prevention_proofs').deleteMany({});
  });

  // Mock DID resolver
  async function mockDIDResolver(did: string) {
    return {
      id: did,
      '@context': 'https://www.w3.org/ns/did/v1',
      verificationMethod: [{
        id: `${did}#key1`,
        type: 'Bls12381G2Key2020',
        controller: did,
        publicKeyBase58: 'mock_public_key'
      }],
      authentication: [`${did}#key1`],
      assertionMethod: [`${did}#key1`],
      keyAgreement: [`${did}#key1`],
      capabilityDelegation: [`${did}#key1`],
      capabilityInvocation: [`${did}#key1`]
    };
  }

  describe('Prescription Credential Creation', () => {
    test('should create prescription credential with BBS+ signature', async () => {
      const prescriptionData = {
        medicationName: 'Amoxicillin 500mg',
        dosage: '500mg',
        frequency: 'twice daily',
        duration: '7 days',
        quantity: 14,
        refills: 0,
        validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      };

      const result = await fraudPreventionService.createPrescriptionCredential({
        doctorDid: testActors.doctor.did,
        patientDid: testActors.patient.did,
        prescriptionData,
        patientInfo: testActors.patient.info,
        doctorInfo: testActors.doctor.info
      });

      expect(result).toBeDefined();
      expect(result.prescriptionCredential).toBeDefined();
      expect(result.prescriptionCredential.type).toContain('PrescriptionCredential');
      expect(result.prescriptionCredential.credentialSubject.prescription.medicationName).toBe('Amoxicillin 500mg');
      expect(result.blockchainAnchor).toBeDefined();
      expect(result.vcToken).toBeDefined();
    });

    test('should enable selective disclosure capabilities', async () => {
      const prescriptionData = {
        medicationName: 'Ibuprofen 200mg',
        dosage: '200mg',
        frequency: 'as needed',
        duration: '30 days',
        quantity: 30,
        refills: 2,
        validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      };

      const result = await fraudPreventionService.createPrescriptionCredential({
        doctorDid: testActors.doctor.did,
        patientDid: testActors.patient.did,
        prescriptionData,
        patientInfo: testActors.patient.info,
        doctorInfo: testActors.doctor.info
      });

      // Test insurance-specific selective disclosure
      const insuranceDisclosure = await kmsClient.deriveVC({
        vc: result.prescriptionCredential,
        frame: DISCLOSURE_FRAMES.insurance
      });

      expect(insuranceDisclosure).toBeDefined();
      expect(insuranceDisclosure.credentialSubject).toBeDefined();
      
      // Insurance should see patient insurance provider but not medication details
      expect(insuranceDisclosure.credentialSubject.patientInfo?.insuranceProvider).toBe('HealthCorp Insurance');
      expect(insuranceDisclosure.credentialSubject.prescription?.medicationName).toBeUndefined();
    });
  });

  describe('Selective Disclosure Frames', () => {
    let prescriptionCredential: any;

    beforeEach(async () => {
      const prescriptionData = {
        medicationName: 'Metformin 1000mg',
        dosage: '1000mg',
        frequency: 'twice daily',
        duration: '90 days',
        quantity: 180,
        refills: 5,
        validUntil: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString()
      };

      const result = await fraudPreventionService.createPrescriptionCredential({
        doctorDid: testActors.doctor.did,
        patientDid: testActors.patient.did,
        prescriptionData,
        patientInfo: testActors.patient.info,
        doctorInfo: testActors.doctor.info
      });

      prescriptionCredential = result.prescriptionCredential;
    });

    test('insurance frame should reveal minimal information', async () => {
      const disclosure = await kmsClient.deriveVC({
        vc: prescriptionCredential,
        frame: DISCLOSURE_FRAMES.insurance
      });

      // Should reveal: patient DID, insurance provider, prescription status, dates
      expect(disclosure.credentialSubject.id).toBe(testActors.patient.did);
      expect(disclosure.credentialSubject.patientInfo?.insuranceProvider).toBe('HealthCorp Insurance');
      expect(disclosure.credentialSubject.prescription?.status).toBe('active');
      
      // Should hide: medication name, dosage, doctor details
      expect(disclosure.credentialSubject.prescription?.medicationName).toBeUndefined();
      expect(disclosure.credentialSubject.doctor).toBeUndefined();
    });

    test('pharmacy frame should reveal medication details but hide personal info', async () => {
      const disclosure = await kmsClient.deriveVC({
        vc: prescriptionCredential,
        frame: DISCLOSURE_FRAMES.pharmacy
      });

      // Should reveal: medication details, prescription info, doctor license
      expect(disclosure.credentialSubject.prescription?.medicationName).toBe('Metformin 1000mg');
      expect(disclosure.credentialSubject.prescription?.dosage).toBe('1000mg');
      expect(disclosure.credentialSubject.doctor?.licenseNumber).toBe('MD123456');
      
      // Should hide: patient personal details, doctor name
      expect(disclosure.credentialSubject.patientInfo?.name).toBeUndefined();
      expect(disclosure.credentialSubject.doctor?.name).toBeUndefined();
    });

    test('audit frame should allow full disclosure', async () => {
      const disclosure = await kmsClient.deriveVC({
        vc: prescriptionCredential,
        frame: DISCLOSURE_FRAMES.audit
      });

      // Should reveal everything for compliance purposes
      expect(disclosure.credentialSubject.patientInfo?.name).toBe('John Doe');
      expect(disclosure.credentialSubject.prescription?.medicationName).toBe('Metformin 1000mg');
      expect(disclosure.credentialSubject.doctor?.name).toBe('Dr. Alice Smith');
    });
  });

  describe('Dispensing Proof Generation', () => {
    let prescriptionCredentialId: string;

    beforeEach(async () => {
      const prescriptionData = {
        medicationName: 'Lisinopril 10mg',
        dosage: '10mg',
        frequency: 'once daily',
        duration: '30 days',
        quantity: 30,
        refills: 3,
        validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      };

      const result = await fraudPreventionService.createPrescriptionCredential({
        doctorDid: testActors.doctor.did,
        patientDid: testActors.patient.did,
        prescriptionData,
        patientInfo: testActors.patient.info,
        doctorInfo: testActors.doctor.info
      });

      prescriptionCredentialId = result.vcToken.id;
    });

    test('should generate valid dispensing proof', async () => {
      const dispensingData = {
        batchNumber: 'BATCH123456',
        expirationDate: '2025-12-31',
        quantityDispensed: 30,
        pharmacyName: 'MediCare Pharmacy',
        pharmacistLicense: 'PH987654'
      };

      const result = await fraudPreventionService.generateDispensingProof({
        pharmacyDid: testActors.pharmacy.did,
        prescriptionCredentialId,
        dispensingData,
        patientConfirmation: true
      });

      expect(result).toBeDefined();
      expect(result.dispensingCredential).toBeDefined();
      expect(result.fraudScore).toBeDefined();
      expect(result.fraudScore).toBeLessThan(50); // Low fraud score for valid dispensing
    });

    test('should detect fraud when quantity exceeds prescription', async () => {
      const dispensingData = {
        batchNumber: 'BATCH789012',
        expirationDate: '2025-12-31',
        quantityDispensed: 60, // Exceeds prescribed quantity of 30
        pharmacyName: 'MediCare Pharmacy',
        pharmacistLicense: 'PH987654'
      };

      const result = await fraudPreventionService.generateDispensingProof({
        pharmacyDid: testActors.pharmacy.did,
        prescriptionCredentialId,
        dispensingData,
        patientConfirmation: true
      });

      expect(result.fraudScore).toBeGreaterThan(30); // Higher fraud score
    });

    test('should increase fraud score without patient confirmation', async () => {
      const dispensingData = {
        batchNumber: 'BATCH345678',
        expirationDate: '2025-12-31',
        quantityDispensed: 30,
        pharmacyName: 'MediCare Pharmacy',
        pharmacistLicense: 'PH987654'
      };

      const result = await fraudPreventionService.generateDispensingProof({
        pharmacyDid: testActors.pharmacy.did,
        prescriptionCredentialId,
        dispensingData,
        patientConfirmation: false // No patient confirmation
      });

      expect(result.fraudScore).toBeGreaterThan(25); // Elevated fraud score
    });
  });

  describe('Insurance Claim Verification', () => {
    let prescriptionCredentialId: string;
    let dispensingCredentialId: string;

    beforeEach(async () => {
      // Create prescription
      const prescriptionData = {
        medicationName: 'Atorvastatin 20mg',
        dosage: '20mg',
        frequency: 'once daily',
        duration: '30 days',
        quantity: 30,
        refills: 5,
        validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      };

      const prescriptionResult = await fraudPreventionService.createPrescriptionCredential({
        doctorDid: testActors.doctor.did,
        patientDid: testActors.patient.did,
        prescriptionData,
        patientInfo: testActors.patient.info,
        doctorInfo: testActors.doctor.info
      });

      prescriptionCredentialId = prescriptionResult.vcToken.id;

      // Create dispensing proof
      const dispensingData = {
        batchNumber: 'BATCH567890',
        expirationDate: '2025-12-31',
        quantityDispensed: 30,
        pharmacyName: 'MediCare Pharmacy',
        pharmacistLicense: 'PH987654'
      };

      const dispensingResult = await fraudPreventionService.generateDispensingProof({
        pharmacyDid: testActors.pharmacy.did,
        prescriptionCredentialId,
        dispensingData,
        patientConfirmation: true
      });

      dispensingCredentialId = dispensingResult.dispensingCredential.id;
    });

    test('should verify legitimate insurance claim', async () => {
      const verificationProof = await fraudPreventionService.verifyInsuranceClaim({
        insurerDid: testActors.insurer.did,
        prescriptionCredentialId,
        dispensingCredentialId,
        claimAmount: 85.50
      });

      expect(verificationProof).toBeDefined();
      expect(verificationProof.patientDid).toBe(testActors.patient.did);
      expect(verificationProof.prescriptionExists).toBe(true);
      expect(verificationProof.medicationDispensed).toBe(true);
      expect(verificationProof.patientConfirmed).toBe(true);
      expect(verificationProof.fraudScore).toBeLessThan(50);
      expect(verificationProof.proofHash).toBeDefined();
    });

    test('should maintain patient privacy during verification', async () => {
      const verificationProof = await fraudPreventionService.verifyInsuranceClaim({
        insurerDid: testActors.insurer.did,
        prescriptionCredentialId,
        dispensingCredentialId
      });

      // Verification should succeed without revealing sensitive medical details
      expect(verificationProof.prescriptionExists).toBe(true);
      expect(verificationProof.medicationDispensed).toBe(true);
      
      // The actual medication name should not be accessible to the insurer
      // (this would be tested by checking what data is actually available in the selective disclosure)
    });
  });

  describe('Fraud Detection Scenarios', () => {
    test('should detect prescription reuse attempt', async () => {
      // Create a prescription
      const prescriptionData = {
        medicationName: 'Oxycodone 5mg',
        dosage: '5mg',
        frequency: 'every 6 hours as needed',
        duration: '7 days',
        quantity: 28,
        refills: 0,
        validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      };

      const prescriptionResult = await fraudPreventionService.createPrescriptionCredential({
        doctorDid: testActors.doctor.did,
        patientDid: testActors.patient.did,
        prescriptionData,
        patientInfo: testActors.patient.info,
        doctorInfo: testActors.doctor.info
      });

      // First dispensing (legitimate)
      const dispensingData1 = {
        batchNumber: 'BATCH111111',
        expirationDate: '2025-12-31',
        quantityDispensed: 28,
        pharmacyName: 'Pharmacy A',
        pharmacistLicense: 'PH111111'
      };

      await fraudPreventionService.generateDispensingProof({
        pharmacyDid: testActors.pharmacy.did,
        prescriptionCredentialId: prescriptionResult.vcToken.id,
        dispensingData: dispensingData1,
        patientConfirmation: true
      });

      // Attempt second dispensing (fraudulent)
      const dispensingData2 = {
        batchNumber: 'BATCH222222',
        expirationDate: '2025-12-31',
        quantityDispensed: 28,
        pharmacyName: 'Pharmacy B',
        pharmacistLicense: 'PH222222'
      };

      // Should throw error or have high fraud score
      await expect(
        fraudPreventionService.generateDispensingProof({
          pharmacyDid: 'did:test:pharmacy999',
          prescriptionCredentialId: prescriptionResult.vcToken.id,
          dispensingData: dispensingData2,
          patientConfirmation: false
        })
      ).rejects.toThrow(); // Prescription already dispensed
    });

    test('should detect expired prescription fraud', async () => {
      // Create an expired prescription
      const prescriptionData = {
        medicationName: 'Codeine 30mg',
        dosage: '30mg',
        frequency: 'every 4 hours as needed',
        duration: '5 days',
        quantity: 30,
        refills: 0,
        validUntil: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() // Expired yesterday
      };

      const prescriptionResult = await fraudPreventionService.createPrescriptionCredential({
        doctorDid: testActors.doctor.did,
        patientDid: testActors.patient.did,
        prescriptionData,
        patientInfo: testActors.patient.info,
        doctorInfo: testActors.doctor.info
      });

      const dispensingData = {
        batchNumber: 'BATCH333333',
        expirationDate: '2025-12-31',
        quantityDispensed: 30,
        pharmacyName: 'Sketchy Pharmacy',
        pharmacistLicense: 'PH333333'
      };

      const result = await fraudPreventionService.generateDispensingProof({
        pharmacyDid: testActors.pharmacy.did,
        prescriptionCredentialId: prescriptionResult.vcToken.id,
        dispensingData,
        patientConfirmation: false
      });

      expect(result.fraudScore).toBeGreaterThan(50); // High fraud score for expired prescription
    });
  });

  describe('Performance Benchmarks', () => {
    test('prescription creation should complete within 500ms', async () => {
      const startTime = performance.now();

      const prescriptionData = {
        medicationName: 'Aspirin 81mg',
        dosage: '81mg',
        frequency: 'once daily',
        duration: '90 days',
        quantity: 90,
        refills: 3,
        validUntil: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString()
      };

      await fraudPreventionService.createPrescriptionCredential({
        doctorDid: testActors.doctor.did,
        patientDid: testActors.patient.did,
        prescriptionData,
        patientInfo: testActors.patient.info,
        doctorInfo: testActors.doctor.info
      });

      const duration = performance.now() - startTime;
      expect(duration).toBeLessThan(500); // Performance requirement
    });

    test('selective disclosure should complete within 100ms', async () => {
      const prescriptionData = {
        medicationName: 'Metoprolol 50mg',
        dosage: '50mg',
        frequency: 'twice daily',
        duration: '30 days',
        quantity: 60,
        refills: 2,
        validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      };

      const prescriptionResult = await fraudPreventionService.createPrescriptionCredential({
        doctorDid: testActors.doctor.did,
        patientDid: testActors.patient.did,
        prescriptionData,
        patientInfo: testActors.patient.info,
        doctorInfo: testActors.doctor.info
      });

      const startTime = performance.now();

      await kmsClient.deriveVC({
        vc: prescriptionResult.prescriptionCredential,
        frame: DISCLOSURE_FRAMES.insurance
      });

      const duration = performance.now() - startTime;
      expect(duration).toBeLessThan(100); // Performance requirement
    });

    test('insurance verification should complete within 200ms', async () => {
      // Setup prescription and dispensing
      const prescriptionData = {
        medicationName: 'Simvastatin 40mg',
        dosage: '40mg',
        frequency: 'once daily at bedtime',
        duration: '30 days',
        quantity: 30,
        refills: 5,
        validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      };

      const prescriptionResult = await fraudPreventionService.createPrescriptionCredential({
        doctorDid: testActors.doctor.did,
        patientDid: testActors.patient.did,
        prescriptionData,
        patientInfo: testActors.patient.info,
        doctorInfo: testActors.doctor.info
      });

      const dispensingResult = await fraudPreventionService.generateDispensingProof({
        pharmacyDid: testActors.pharmacy.did,
        prescriptionCredentialId: prescriptionResult.vcToken.id,
        dispensingData: {
          batchNumber: 'BATCH444444',
          expirationDate: '2025-12-31',
          quantityDispensed: 30,
          pharmacyName: 'MediCare Pharmacy',
          pharmacistLicense: 'PH987654'
        },
        patientConfirmation: true
      });

      const startTime = performance.now();

      await fraudPreventionService.verifyInsuranceClaim({
        insurerDid: testActors.insurer.did,
        prescriptionCredentialId: prescriptionResult.vcToken.id,
        dispensingCredentialId: dispensingResult.dispensingCredential.id
      });

      const duration = performance.now() - startTime;
      expect(duration).toBeLessThan(200); // Performance requirement
    });
  });

  describe('System Statistics and Analytics', () => {
    test('should provide fraud prevention statistics', async () => {
      // Create some test data
      const prescriptionData = {
        medicationName: 'Losartan 50mg',
        dosage: '50mg',
        frequency: 'once daily',
        duration: '30 days',
        quantity: 30,
        refills: 5,
        validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      };

      const prescriptionResult = await fraudPreventionService.createPrescriptionCredential({
        doctorDid: testActors.doctor.did,
        patientDid: testActors.patient.did,
        prescriptionData,
        patientInfo: testActors.patient.info,
        doctorInfo: testActors.doctor.info
      });

      const dispensingResult = await fraudPreventionService.generateDispensingProof({
        pharmacyDid: testActors.pharmacy.did,
        prescriptionCredentialId: prescriptionResult.vcToken.id,
        dispensingData: {
          batchNumber: 'BATCH555555',
          expirationDate: '2025-12-31',
          quantityDispensed: 30,
          pharmacyName: 'MediCare Pharmacy',
          pharmacistLicense: 'PH987654'
        },
        patientConfirmation: true
      });

      await fraudPreventionService.verifyInsuranceClaim({
        insurerDid: testActors.insurer.did,
        prescriptionCredentialId: prescriptionResult.vcToken.id,
        dispensingCredentialId: dispensingResult.dispensingCredential.id
      });

      const statistics = await fraudPreventionService.getStatistics();

      expect(statistics).toBeDefined();
      expect(statistics.totalVerifications).toBeGreaterThanOrEqual(1);
      expect(statistics.averageFraudScore).toBeGreaterThanOrEqual(0);
      expect(statistics.fraudAttempts).toBeGreaterThanOrEqual(0);
    });
  });
});