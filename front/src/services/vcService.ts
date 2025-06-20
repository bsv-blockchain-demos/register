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
import { API_BASE_URL } from '../config';

/**
 * Service for creating and managing Verifiable Credentials
 */
class VCService {
  /**
   * Create a Prescription Verifiable Credential
   */
  async createPrescriptionVC(
    formData: PrescriptionFormData,
    patient: Actor,
    doctor: Actor
  ): Promise<PrescriptionCredential> {
    if (!patient.did || !doctor.did) {
      throw new Error('Patient and doctor must have DIDs');
    }

    const vcId = uuidv4();
    const prescriptionId = encryptionService.hash(
      `${patient.did}-${doctor.did}-${Date.now()}-${formData.medicationName}`
    );

    // Prepare the VC structure without proof
    const credentialSubject = {
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
    };

    // Call backend to issue the VC
    const response = await fetch(`${API_BASE_URL}/vcs/issue`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        issuerDid: doctor.did,
        subjectDid: patient.did,
        credentialSubject,
        vcType: 'PrescriptionCredential',
        vcId
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to issue prescription VC');
    }

    const { vc } = await response.json();
    return vc as PrescriptionCredential;
  }

  /**
   * Create a Dispensation Verifiable Credential
   */
  async createDispensationVC(
    prescriptionVC: PrescriptionCredential,
    formData: DispensationFormData,
    pharmacy: Actor
  ): Promise<DispensationCredential> {
    if (!pharmacy.did) {
      throw new Error('Pharmacy must have a DID');
    }

    const vcId = uuidv4();

    // Prepare the VC structure without proof
    const credentialSubject = {
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
    };

    // Call backend to issue the VC
    const response = await fetch(`${API_BASE_URL}/vcs/issue`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        issuerDid: pharmacy.did,
        subjectDid: prescriptionVC.credentialSubject.id,
        credentialSubject,
        vcType: 'DispensationCredential',
        vcId
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to issue dispensation VC');
    }

    const { vc } = await response.json();
    return vc as DispensationCredential;
  }

  /**
   * Create a Confirmation Verifiable Credential
   */
  async createConfirmationVC(
    prescriptionVC: PrescriptionCredential,
    formData: ConfirmationFormData,
    patient: Actor
  ): Promise<ConfirmationCredential> {
    if (!patient.did) {
      throw new Error('Patient must have a DID');
    }

    const vcId = uuidv4();

    // Prepare the VC structure without proof
    const credentialSubject = {
      id: patient.did,
      confirmation: {
        prescriptionId: prescriptionVC.credentialSubject.prescription.id,
        confirmedDate: new Date().toISOString(),
        confirmationType: 'patient-confirmation', // Default type
        status: formData.status,
        notes: formData.notes || ''
      }
    };

    // Call backend to issue the VC
    const response = await fetch(`${API_BASE_URL}/vcs/issue`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        issuerDid: patient.did,
        subjectDid: patient.did,
        credentialSubject,
        vcType: 'ConfirmationCredential',
        vcId
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to issue confirmation VC');
    }

    const { vc } = await response.json();
    return vc as ConfirmationCredential;
  }

  /**
   * Verify a Verifiable Credential's signature
   */
  async verifyVC(vc: PrescriptionCredential | DispensationCredential | ConfirmationCredential): Promise<boolean> {
    if (!vc.proof) {
      return false;
    }

    try {
      // Call backend to verify the VC
      const response = await fetch(`${API_BASE_URL}/vcs/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ vc })
      });

      if (!response.ok) {
        return false;
      }

      const { valid } = await response.json();
      return valid;
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
