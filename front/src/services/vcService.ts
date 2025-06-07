// src/services/vcService.ts
import { v4 as uuidv4 } from 'uuid';
import type {
  PrescriptionCredential,
  DispensationCredential,
  ConfirmationCredential,
  PrescriptionFormData,
  DispensationFormData,
  ConfirmationFormData,
  Actor
} from '../types';
import { encryptionService } from './encryptionService';

/**
 * Service for creating and managing Verifiable Credentials
 */
class VCService {
  /**
   * Create a Prescription Verifiable Credential
   */
  createPrescriptionVC(
    formData: PrescriptionFormData,
    patient: Actor,
    doctor: Actor
  ): PrescriptionCredential {
    if (!patient.did || !doctor.did) {
      throw new Error('Patient and doctor must have DIDs');
    }

    const vcId = uuidv4();
    const prescriptionId = encryptionService.hash(
      `${patient.did}-${doctor.did}-${Date.now()}-${formData.medicationName}`
    );

    const prescriptionVC: PrescriptionCredential = {
      '@context': [
        'https://www.w3.org/2018/credentials/v1',
        'https://schema.org/',
        'https://quarkid.org/medical/v1'
      ],
      id: vcId,
      type: ['VerifiableCredential', 'PrescriptionCredential'],
      issuer: doctor.did,
      issuanceDate: new Date().toISOString(),
      credentialSubject: {
        id: patient.did,
        patientInfo: {
          name: formData.patientName,
          identificationNumber: formData.patientId,
          age: formData.patientAge,
          insuranceProvider: formData.insuranceProvider
        },
        prescription: {
          id: prescriptionId,
          diagnosis: formData.diagnosis,
          medication: {
            name: formData.medicationName,
            dosage: formData.dosage,
            frequency: formData.frequency,
            duration: formData.duration
          },
          doctorId: doctor.did,
          prescribedDate: new Date().toISOString(),
          status: 'no dispensado'
        }
      }
    };

    // Add proof (simplified implementation)
    if (doctor.privateKey) {
      const vcString = JSON.stringify({
        ...prescriptionVC,
        proof: undefined // Exclude proof from signing
      });
      
      prescriptionVC.proof = {
        type: 'Ed25519Signature2018',
        created: new Date().toISOString(),
        verificationMethod: `${doctor.did}#key-1`,
        proofPurpose: 'assertionMethod',
        jws: encryptionService.sign(vcString, doctor.privateKey)
      };
    }

    return prescriptionVC;
  }

  /**
   * Create a Dispensation Verifiable Credential
   */
  createDispensationVC(
    prescriptionVC: PrescriptionCredential,
    formData: DispensationFormData,
    pharmacy: Actor
  ): DispensationCredential {
    if (!pharmacy.did) {
      throw new Error('Pharmacy must have a DID');
    }

    const vcId = uuidv4();

    const dispensationVC: DispensationCredential = {
      '@context': [
        'https://www.w3.org/2018/credentials/v1',
        'https://schema.org/',
        'https://quarkid.org/medical/v1'
      ],
      id: vcId,
      type: ['VerifiableCredential', 'DispensationCredential'],
      issuer: pharmacy.did,
      issuanceDate: new Date().toISOString(),
      credentialSubject: {
        id: prescriptionVC.credentialSubject.id, // Patient DID
        prescription: {
          id: prescriptionVC.credentialSubject.prescription.id,
          medication: {
            name: prescriptionVC.credentialSubject.prescription.medication.name,
            batchNumber: formData.batchNumber,
            expirationDate: formData.expirationDate,
            manufacturer: formData.manufacturer
          },
          dispensedDate: new Date().toISOString(),
          pharmacyId: pharmacy.did,
          pharmacistId: formData.pharmacistId
        }
      }
    };

    // Add proof
    if (pharmacy.privateKey) {
      const vcString = JSON.stringify({
        ...dispensationVC,
        proof: undefined
      });
      
      dispensationVC.proof = {
        type: 'Ed25519Signature2018',
        created: new Date().toISOString(),
        verificationMethod: `${pharmacy.did}#key-1`,
        proofPurpose: 'assertionMethod',
        jws: encryptionService.sign(vcString, pharmacy.privateKey)
      };
    }

    return dispensationVC;
  }

  /**
   * Create a Confirmation Verifiable Credential
   */
  createConfirmationVC(
    prescriptionVC: PrescriptionCredential,
    formData: ConfirmationFormData,
    patient: Actor
  ): ConfirmationCredential {
    if (!patient.did) {
      throw new Error('Patient must have a DID');
    }

    const vcId = uuidv4();

    const confirmationVC: ConfirmationCredential = {
      '@context': [
        'https://www.w3.org/2018/credentials/v1',
        'https://schema.org/',
        'https://quarkid.org/medical/v1'
      ],
      id: vcId,
      type: ['VerifiableCredential', 'ConfirmationCredential'],
      issuer: patient.did,
      issuanceDate: new Date().toISOString(),
      credentialSubject: {
        id: patient.did,
        confirmation: {
          prescriptionId: prescriptionVC.credentialSubject.prescription.id,
          confirmedDate: new Date().toISOString(),
          status: formData.status,
          notes: formData.notes
        }
      }
    };

    // Add proof
    if (patient.privateKey) {
      const vcString = JSON.stringify({
        ...confirmationVC,
        proof: undefined
      });
      
      confirmationVC.proof = {
        type: 'Ed25519Signature2018',
        created: new Date().toISOString(),
        verificationMethod: `${patient.did}#key-1`,
        proofPurpose: 'assertionMethod',
        jws: encryptionService.sign(vcString, patient.privateKey)
      };
    }

    return confirmationVC;
  }

  /**
   * Verify a Verifiable Credential's signature
   */
  verifyVC(vc: PrescriptionCredential | DispensationCredential | ConfirmationCredential): boolean {
    if (!vc.proof) {
      return false;
    }

    try {
      // Extract proof and create verification string
      const vcWithoutProof = {
        ...vc,
        proof: undefined
      };
      const vcString = JSON.stringify(vcWithoutProof);
      
      // In a real implementation, we would:
      // 1. Resolve the DID to get the public key
      // 2. Verify the signature using the public key
      // For this demo, we'll do basic format validation
      
      return (
        vc.proof.type === 'Ed25519Signature2018' &&
        vc.proof.jws &&
        vc.proof.jws.length === 64 && // Basic signature format check
        vc.proof.verificationMethod &&
        vc.proof.created
      );
    } catch (error) {
      console.error('VC verification failed:', error);
      return false;
    }
  }

  /**
   * Update prescription status to dispensed
   */
  updatePrescriptionStatus(
    prescriptionVC: PrescriptionCredential,
    status: 'no dispensado' | 'dispensado'
  ): PrescriptionCredential {
    return {
      ...prescriptionVC,
      credentialSubject: {
        ...prescriptionVC.credentialSubject,
        prescription: {
          ...prescriptionVC.credentialSubject.prescription,
          status
        }
      }
    };
  }

  /**
   * Extract prescription summary for display
   */
  getPrescriptionSummary(vc: PrescriptionCredential) {
    const { prescription, patientInfo } = vc.credentialSubject;
    
    return {
      id: prescription.id,
      patientName: patientInfo.name,
      medicationName: prescription.medication.name,
      dosage: prescription.medication.dosage,
      frequency: prescription.medication.frequency,
      duration: prescription.medication.duration,
      diagnosis: prescription.diagnosis,
      prescribedDate: prescription.prescribedDate,
      status: prescription.status,
      doctorId: prescription.doctorId
    };
  }

  /**
   * Extract dispensation summary for display
   */
  getDispensationSummary(vc: DispensationCredential) {
    const { prescription } = vc.credentialSubject;
    
    return {
      prescriptionId: prescription.id,
      medicationName: prescription.medication.name,
      batchNumber: prescription.medication.batchNumber,
      expirationDate: prescription.medication.expirationDate,
      manufacturer: prescription.medication.manufacturer,
      dispensedDate: prescription.dispensedDate,
      pharmacyId: prescription.pharmacyId,
      pharmacistId: prescription.pharmacistId
    };
  }

  /**
   * Extract confirmation summary for display
   */
  getConfirmationSummary(vc: ConfirmationCredential) {
    const { confirmation } = vc.credentialSubject;
    
    return {
      prescriptionId: confirmation.prescriptionId,
      confirmedDate: confirmation.confirmedDate,
      status: confirmation.status,
      notes: confirmation.notes
    };
  }

  /**
   * Generate a hash for a VC (for unique identification)
   */
  generateVCHash(vc: PrescriptionCredential | DispensationCredential | ConfirmationCredential): string {
    const vcString = JSON.stringify({
      ...vc,
      proof: undefined // Exclude proof from hash
    });
    
    return encryptionService.hash(vcString);
  }

  /**
   * Validate VC structure
   */
  validateVC(vc: unknown): boolean {
    try {
      const credential = vc as any;
      
      return (
        credential['@context'] &&
        Array.isArray(credential['@context']) &&
        credential.id &&
        credential.type &&
        Array.isArray(credential.type) &&
        credential.issuer &&
        credential.issuanceDate &&
        credential.credentialSubject
      );
    } catch (error) {
      return false;
    }
  }
}

export const vcService = new VCService();
