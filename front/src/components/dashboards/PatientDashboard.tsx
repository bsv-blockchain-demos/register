import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useApp } from '../../context/AppContext';
import { Link } from 'react-router-dom';
import type { PrescriptionCredential, Actor } from '../../types';
import { apiService } from '../../services/apiService';
import { FiFileText, FiClock, FiCheckCircle, FiAlertCircle } from 'react-icons/fi';

interface DispensedPrescription extends PrescriptionCredential {
  status: 'dispensed' | 'confirmed';
  dispensation?: {
    _id: string;
    prescriptionId: string;
    pharmacyDid: string;
    patientDid: string;
    medicationProvided: string;
    batchNumber?: string;
    expiryDate?: string;
    pharmacistNotes?: string;
    dispensedAt: string;
    status: string;
  };
  confirmation?: {
    _id: string;
    prescriptionId: string;
    patientDid: string;
    pharmacyDid: string;
    confirmationNotes?: string;
    confirmedAt: string;
    dispensationId: string;
    status: string;
    type: string;
    vcData: {
      '@context': string[];
      type: string[];
      issuer: string;
      issuanceDate: string;
      credentialSubject: {
        id: string;
        prescriptionId: string;
        pharmacyDid: string;
        confirmationTimestamp: string;
        dispensationId: string;
      };
    };
  };
}

const PatientDashboard: React.FC = () => {
  const { currentUser } = useAuth();
  const { state, dispatch } = useApp();
  const [prescriptions, setPrescriptions] = useState<PrescriptionCredential[]>([]);
  const [dispensedPrescriptions, setDispensedPrescriptions] = useState<DispensedPrescription[]>([]);
  const [doctors, setDoctors] = useState<Actor[]>([]);
  const [pharmacies, setPharmacies] = useState<Actor[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPharmacyModal, setShowPharmacyModal] = useState(false);
  const [selectedPharmacy, setSelectedPharmacy] = useState<Actor | null>(null);
  const [prescriptionToShare, setPrescriptionToShare] = useState<PrescriptionCredential | null>(null);
  const [confirmingPrescription, setConfirmingPrescription] = useState<string | null>(null);

  // Load actors from backend
  const loadActors = useCallback(async () => {
    try {
      const response = await apiService.getActors();
      if (response.success && response.data) {
        dispatch({ type: 'SET_ACTORS', payload: response.data });
      }
    } catch (error) {
      console.error('Failed to load actors:', error);
    }
  }, [dispatch]);

  const loadPrescriptions = useCallback(async () => {
    if (!currentUser?.did) return;
    
    try {
      setLoading(true);
      console.log('[PatientDashboard] Loading enhanced prescriptions for:', currentUser.did);
      
      // Use enhanced prescriptions endpoint
      const response = await apiService.getEnhancedPrescriptionsByPatient(currentUser.did);
      console.log('[PatientDashboard] Enhanced API response:', response);
      
      if (response.success && response.data) {
        // Transform enhanced prescription tokens to match existing prescription format
        const transformedPrescriptions = response.data.map((token: {
          id: string;
          doctorDid: string;
          patientDid: string;
          createdAt: string;
          status: string;
          prescriptionVC?: {
            credentialSubject?: {
              medicationName?: string;
              dosage?: string;
              instructions?: string;
            };
          };
        }) => {
          // Extract medication data from prescriptionVC.credentialSubject
          const credentialSubject = token.prescriptionVC?.credentialSubject || {};
          const medicationName = credentialSubject.medicationName || 'Unknown Medication';
          const dosage = credentialSubject.dosage || 'No dosage specified';
          const instructions = credentialSubject.instructions || '';
          
          // Find doctor name from actors
          const doctor = state.actors?.find(a => a.did === token.doctorDid);
          const doctorName = doctor?.name || 'Unknown Doctor';
          
          return {
            id: token.id,
            issuer: token.doctorDid,
            issuanceDate: token.createdAt,
            credentialSubject: {
              id: token.patientDid,
              patientInfo: {
                name: currentUser.name
              },
              prescription: {
                id: token.id,
                doctorName: doctorName,
                medication: {
                  name: medicationName,
                  dosage: dosage,
                  frequency: instructions,
                  duration: ''
                },
                prescribedDate: token.createdAt,
                status: token.status === 'dispensed' ? 'dispensado' : 'no dispensado',
              }
            }
          };
        });
        
        console.log('[PatientDashboard] Transformed prescriptions:', transformedPrescriptions);
        setPrescriptions(transformedPrescriptions);
      } else {
        console.log('[PatientDashboard] No prescriptions found or error:', response);
        setPrescriptions([]);
      }
    } catch (error) {
      console.error('Failed to load prescriptions:', error);
      setPrescriptions([]);
    } finally {
      setLoading(false);
    }
  }, [currentUser?.did, currentUser?.name, state.actors]);

  const loadDispensedPrescriptions = useCallback(async () => {
    if (!currentUser?.did) return;
    
    try {
      console.log('[PatientDashboard] Loading enhanced prescriptions for patient:', currentUser.did);
      const response = await apiService.getEnhancedPrescriptionsByPatient(currentUser.did);
      
      if (response.success && response.data) {
        // Filter for dispensed and confirmed prescriptions
        const dispensedOrConfirmed = response.data.filter((token: any) => 
          token.status === 'dispensed' || token.status === 'confirmed'
        );
        
        // Transform the enhanced prescription tokens to match the expected structure
        const transformedPrescriptions = dispensedOrConfirmed.map((token: any) => {
          const prescriptionVC = token.prescriptionVC || {};
          
          // Create a structure that matches DispensedPrescription interface
          const transformed: DispensedPrescription = {
            ...prescriptionVC, // This spreads the base PrescriptionCredential structure
            id: token.id, // Override with the token ID
            status: token.status as 'dispensed' | 'confirmed',
            dispensation: token.dispensationVC ? {
              _id: token.id,
              prescriptionId: token.id,
              pharmacyDid: token.pharmacyDid || '',
              patientDid: token.patientDid || '',
              medicationProvided: token.dispensationVC.credentialSubject?.medicationProvided || '',
              batchNumber: token.dispensationVC.credentialSubject?.batchNumber,
              expiryDate: token.dispensationVC.credentialSubject?.expiryDate,
              pharmacistNotes: token.dispensationVC.credentialSubject?.pharmacistSignature,
              dispensedAt: token.dispensationVC.credentialSubject?.dispensedAt || token.tokenState?.dispensedAt || new Date().toISOString(),
              status: 'dispensed'
            } : undefined,
            confirmation: token.confirmationVC ? {
              _id: token.id,
              prescriptionId: token.id,
              patientDid: token.patientDid || '',
              pharmacyDid: token.pharmacyDid || '',
              confirmationNotes: token.confirmationVC.credentialSubject?.patientSignature,
              confirmedAt: token.confirmationVC.credentialSubject?.confirmedAt || token.tokenState?.confirmedAt || new Date().toISOString(),
              dispensationId: token.id,
              status: 'confirmed',
              type: 'confirmation',
              vcData: token.confirmationVC
            } : undefined
          };
          
          return transformed;
        });
        
        console.log('[PatientDashboard] Transformed dispensed prescriptions:', transformedPrescriptions);
        // Log the first prescription in detail to debug
        if (transformedPrescriptions.length > 0) {
          console.log('[PatientDashboard] First dispensed prescription details:', {
            id: transformedPrescriptions[0].id,
            tokenId: transformedPrescriptions[0].tokenId,
            status: transformedPrescriptions[0].status,
            hasConfirmation: !!transformedPrescriptions[0].confirmation,
            confirmationVC: transformedPrescriptions[0].confirmationVC
          });
        }
        setDispensedPrescriptions(transformedPrescriptions);
      }
    } catch (error) {
      console.error('Failed to load dispensed prescriptions:', error);
    }
  }, [currentUser?.did]);

  useEffect(() => {
    // Load actors first
    loadActors();
  }, [loadActors]);

  useEffect(() => {
    // Get all doctors
    if (state.actors) {
      const allDoctors = state.actors.filter(a => a.type === 'doctor');
      setDoctors(allDoctors);
      
      // Get all pharmacies
      const allPharmacies = state.actors.filter(a => a.type === 'pharmacy');
      setPharmacies(allPharmacies);
    }

    loadPrescriptions();
    loadDispensedPrescriptions();
  }, [currentUser, state.actors, loadPrescriptions, loadDispensedPrescriptions]);

  const activePrescriptions = prescriptions.filter(p => 
    p.credentialSubject.prescription.status === 'no dispensado'
  );
  
  const dispensedPrescriptionsFiltered = prescriptions.filter(p => 
    p.credentialSubject.prescription.status === 'dispensado'
  );

  const recentPrescriptions = [...prescriptions]
    .sort((a, b) => new Date(b.issuanceDate).getTime() - new Date(a.issuanceDate).getTime())
    .slice(0, 5);

  const handleSharePrescription = async (prescription: PrescriptionCredential) => {
    try {
      // Set the prescription to share
      setPrescriptionToShare(prescription);
      
      // Load pharmacies
      const response = await apiService.getActors({ type: 'pharmacy' });
      if (response.success && response.data) {
        setPharmacies(response.data);
        setShowPharmacyModal(true);
      } else {
        alert('Failed to load pharmacies. Please try again.');
      }
    } catch (error) {
      console.error('Error loading pharmacies:', error);
      alert('Failed to load pharmacies');
    }
  };

  const handleConfirmShare = async () => {
    if (!selectedPharmacy || !prescriptionToShare || !currentUser) {
      return;
    }

    try {
      // Call the enhanced share prescription API
      const response = await apiService.sharePrescription({
        prescriptionId: prescriptionToShare.id || '',
        patientDid: currentUser.did || '',
        pharmacyDid: selectedPharmacy.did || ''
      });

      if (response.success) {
        alert(`Prescription shared successfully with ${selectedPharmacy.name}`);
        setShowPharmacyModal(false);
        setSelectedPharmacy(null);
        setPrescriptionToShare(null);
        
        // Refresh prescriptions to update UI
        await loadPrescriptions();
      } else {
        alert(`Failed to share prescription: ${response.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error sharing prescription:', error);
      alert('Failed to share prescription. Please try again.');
    }
  };

  const handleConfirmDispensation = async (prescriptionId: string) => {
    console.log('[PatientDashboard] handleConfirmDispensation called with ID:', prescriptionId);
    
    if (!prescriptionId) {
      console.error('[PatientDashboard] No prescription ID provided');
      alert('Error: No prescription ID available');
      return;
    }
    
    if (!currentUser?.did) {
      console.error('[PatientDashboard] No current user DID');
      return;
    }
    
    try {
      setConfirmingPrescription(prescriptionId);
      
      console.log('[PatientDashboard] Calling confirmEnhancedPrescription with:', {
        prescriptionId,
        patientSignature: 'Medication received successfully'
      });
      
      const response = await apiService.confirmEnhancedPrescription(prescriptionId, {
        patientSignature: 'Medication received successfully' // In a real app, this would be a proper digital signature
      });
      
      console.log('[PatientDashboard] Confirmation response:', response);
      
      if (response.success) {
        alert('Prescription confirmation recorded successfully');
        // Reload dispensed prescriptions to update the UI
        loadDispensedPrescriptions();
      } else {
        console.error('[PatientDashboard] Confirmation failed:', response);
        alert(`Failed to confirm prescription: ${response.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('[PatientDashboard] Error confirming prescription:', error);
      alert(`Failed to confirm prescription: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setConfirmingPrescription(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Patient Dashboard</h1>
          <p className="text-gray-400">Welcome back, {currentUser?.name}</p>
          {currentUser?.insuranceProvider && (
            <p className="text-sm text-gray-500 mt-1">Insurance: {currentUser.insuranceProvider}</p>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          {/* Total Prescriptions */}
          <div className="bg-gray-800 rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-gray-400">Total Prescriptions</h3>
              <FiFileText className="text-blue-500 text-2xl" />
            </div>
            <p className="text-3xl font-bold text-white">{prescriptions.length}</p>
            <p className="text-sm text-gray-500 mt-2">All time</p>
          </div>

          {/* Active Prescriptions */}
          <div className="bg-gray-800 rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-gray-400">Active</h3>
              <FiAlertCircle className="text-yellow-500 text-2xl" />
            </div>
            <p className="text-3xl font-bold text-white">{activePrescriptions.length}</p>
            <p className="text-sm text-gray-500 mt-2">Ready for pickup</p>
          </div>

          {/* Dispensed */}
          <div className="bg-gray-800 rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-gray-400">Dispensed</h3>
              <FiCheckCircle className="text-green-500 text-2xl" />
            </div>
            <p className="text-3xl font-bold text-white">{dispensedPrescriptionsFiltered.length}</p>
            <p className="text-sm text-gray-500 mt-2">Completed</p>
          </div>

          {/* This Month */}
          <div className="bg-gray-800 rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-gray-400">This Month</h3>
              <FiClock className="text-purple-500 text-2xl" />
            </div>
            <p className="text-3xl font-bold text-white">
              {prescriptions.filter(p => {
                const date = new Date(p.issuanceDate);
                const now = new Date();
                return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
              }).length}
            </p>
            <p className="text-sm text-gray-500 mt-2">Recent prescriptions</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Active Prescriptions List */}
          <div className="lg:col-span-2">
            <div className="bg-gray-800 rounded-lg">
              <div className="border-b border-gray-700 p-6">
                <h2 className="text-lg font-semibold text-white">My Prescriptions</h2>
              </div>
              <div className="p-6">
                {loading ? (
                  <p className="text-gray-400 text-center py-8">Loading prescriptions...</p>
                ) : prescriptions.length === 0 ? (
                  <p className="text-gray-400 text-center py-8">No prescriptions found</p>
                ) : (
                  <div className="space-y-4">
                    {recentPrescriptions.map((prescription, index) => {
                      const doctor = doctors.find(d => d.did === prescription.issuer);
                      const prescriptionData = prescription.credentialSubject.prescription;
                      
                      return (
                        <div key={prescription.id || index} className="border border-gray-700 rounded-lg p-4">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <h4 className="font-medium text-white">{prescriptionData.medication.name}</h4>
                              <p className="text-gray-400 mt-1">
                                <strong>Dosage:</strong> {prescriptionData.medication.dosage} | 
                                <strong> Frequency:</strong> {prescriptionData.medication.frequency}
                              </p>
                              <p className="text-gray-400">
                                <strong>Duration:</strong> {prescriptionData.medication.duration}
                              </p>
                              <p className="text-sm text-gray-500 mt-2">
                                <strong>Diagnosis:</strong> {prescriptionData.diagnosis}
                              </p>
                              <p className="text-sm text-gray-500">
                                <strong>Doctor:</strong> {doctor?.name || 'Unknown'}
                              </p>
                              <p className="text-xs text-gray-600 mt-2">
                                Prescribed: {new Date(prescriptionData.prescribedDate).toLocaleDateString()}
                              </p>
                            </div>
                            <div className="ml-4">
                              <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                                prescriptionData.status === 'no dispensado'
                                  ? 'bg-yellow-500/20 text-yellow-500'
                                  : 'bg-green-500/20 text-green-500'
                              }`}>
                                {prescriptionData.status === 'no dispensado' ? 'Active' : 'Dispensed'}
                              </span>
                            </div>
                          </div>
                          
                          {prescriptionData.status === 'dispensado' && (
                            <div className="mt-4 flex gap-2">
                              <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                                Confirm Receipt
                              </button>
                              <button className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                                View Details
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Quick Actions & Info */}
          <div>
            <div className="bg-gray-800 rounded-lg">
              <div className="border-b border-gray-700 p-6">
                <h2 className="text-lg font-semibold text-white">Quick Actions</h2>
              </div>
              <div className="p-6 space-y-4">
                <Link
                  to="/scan"
                  className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded-lg font-medium transition-colors"
                >
                  📱 Scan QR Code
                </Link>

                <Link
                  to="/prescription-dashboard"
                  className="block bg-gray-700 hover:bg-gray-600 p-4 rounded-lg transition-colors group"
                >
                  <h3 className="font-medium text-white">📊 Prescription History</h3>
                  <p className="text-sm text-gray-400 mt-1">View all prescriptions</p>
                </Link>

                <Link
                  to="/did-resolver"
                  className="block bg-gray-700 hover:bg-gray-600 p-4 rounded-lg transition-colors group"
                >
                  <h3 className="font-medium text-white">🔐 Verify Credentials</h3>
                  <p className="text-sm text-gray-400 mt-1">Check DIDs and VCs</p>
                </Link>
              </div>
            </div>

            {/* Patient Info */}
            <div className="bg-gray-800 rounded-lg mt-6">
              <div className="p-6">
                <h3 className="text-sm font-medium text-gray-400 mb-2">Your Information</h3>
                <p className="text-white font-medium">{currentUser?.name}</p>
                <p className="text-xs text-gray-500 mt-1">DID: {currentUser?.did?.slice(0, 20)}...</p>
                {currentUser?.insuranceProvider && (
                  <p className="text-xs text-gray-500">Insurance: {currentUser.insuranceProvider}</p>
                )}
              </div>
            </div>

            {/* Active Prescriptions Summary */}
            {activePrescriptions.length > 0 && (
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg mt-6 p-4">
                <h3 className="text-sm font-medium text-yellow-500 mb-2">
                  ⚠️ Active Prescriptions
                </h3>
                <p className="text-xs text-gray-400">
                  You have {activePrescriptions.length} prescription{activePrescriptions.length !== 1 ? 's' : ''} ready for pickup.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Dispensed Prescriptions Section */}
        <div className="bg-gray-900 rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-2xl font-bold mb-4 text-white flex items-center">
            <FiCheckCircle className="mr-2 text-green-500" />
            Dispensed Prescriptions
          </h2>
          {dispensedPrescriptions.length === 0 ? (
            <p className="text-gray-400">No dispensed prescriptions</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-gray-400 border-b border-gray-700">
                    <th className="py-3 px-4">Medication</th>
                    <th className="py-3 px-4">Doctor</th>
                    <th className="py-3 px-4">Dispensed Date</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {dispensedPrescriptions.map((prescription) => {
                    const prescriptionData = prescription.credentialSubject?.prescription;
                    const doctorName = doctors.find(d => d.did === prescription.issuer)?.name || 'Unknown Doctor';
                    
                    return (
                      <tr key={prescription.id} className="border-b border-gray-800">
                        <td className="py-3 px-4">
                          <div>
                            <p className="font-medium text-white">{prescriptionData?.medication?.name || 'Unknown'}</p>
                            <p className="text-sm text-gray-400">{prescriptionData?.medication?.dosage || 'N/A'}</p>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-gray-300">
                          {doctorName}
                        </td>
                        <td className="py-3 px-4 text-gray-300">
                          {prescription.dispensation?.dispensedAt ? 
                            new Date(prescription.dispensation.dispensedAt).toLocaleDateString() : 
                            'N/A'
                          }
                        </td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-1 rounded text-xs ${
                            prescription.status === 'confirmed'
                              ? 'bg-green-500/20 text-green-500'
                              : 'bg-yellow-500/20 text-yellow-500'
                          }`}>
                            {prescription.status === 'confirmed' ? 'Confirmed' : 'Awaiting Confirmation'}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          {prescription.status === 'dispensed' && !prescription.confirmation && (
                            <button 
                              onClick={() => handleConfirmDispensation(prescription.id || '')}
                              disabled={confirmingPrescription === prescription.id}
                              className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600 disabled:bg-gray-500 text-sm"
                            >
                              {confirmingPrescription === prescription.id ? 'Confirming...' : 'Confirm Receipt'}
                            </button>
                          )}
                          {prescription.status === 'confirmed' && (
                            <span className="text-green-500 text-sm">✓ Confirmed</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Recent Prescriptions */}
        <div className="bg-gray-800 rounded-lg p-6 mt-8">
          <h2 className="text-xl font-bold mb-4">Recent Prescriptions</h2>
          
          {loading ? (
            <p className="text-gray-400">Loading...</p>
          ) : prescriptions.length === 0 ? (
            <p className="text-gray-400">No prescriptions found</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-700">
                    <th className="text-left py-3 px-4 text-gray-400">Medication</th>
                    <th className="text-left py-3 px-4 text-gray-400">Doctor</th>
                    <th className="text-left py-3 px-4 text-gray-400">Date</th>
                    <th className="text-left py-3 px-4 text-gray-400">Status</th>
                    <th className="text-left py-3 px-4 text-gray-400">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {recentPrescriptions.map((prescription, index) => {
                    const doctor = doctors.find(d => d.did === prescription.issuer);
                    const prescriptionData = prescription.credentialSubject.prescription;
                    
                    return (
                      <tr key={prescription.id || index} className="border-b border-gray-700">
                        <td className="py-3 px-4">
                          <div>
                            <p className="font-medium text-white">{prescriptionData.medication.name}</p>
                            <p className="text-sm text-gray-400">{prescriptionData.medication.dosage}</p>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-gray-300">
                          {doctor?.name || 'Unknown'}
                        </td>
                        <td className="py-3 px-4 text-gray-300">
                          {new Date(prescriptionData.prescribedDate).toLocaleDateString()}
                        </td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-1 rounded text-xs ${
                            prescriptionData.status === 'no dispensado'
                              ? 'bg-yellow-500/20 text-yellow-500'
                              : 'bg-green-500/20 text-green-500'
                          }`}>
                            {prescriptionData.status === 'no dispensado' ? 'Active' : 'Dispensed'}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <button className="text-blue-500 hover:text-blue-400 text-sm">
                            View Details
                          </button>
                          <button className="text-blue-500 hover:text-blue-400 text-sm ml-2" onClick={() => handleSharePrescription(prescription)}>
                            Share Prescription
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
        
        {/* Pharmacy Selection Modal */}
        {showPharmacyModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full">
              <h3 className="text-xl font-bold mb-4">Select a Pharmacy</h3>
              
              {pharmacies.length === 0 ? (
                <p className="text-gray-400 mb-4">No pharmacies available</p>
              ) : (
                <div className="space-y-2 mb-4">
                  {pharmacies.map((pharmacy) => (
                    <label
                      key={pharmacy.id}
                      className="flex items-center p-3 border border-gray-700 rounded-lg hover:bg-gray-700 cursor-pointer"
                    >
                      <input
                        type="radio"
                        name="pharmacy"
                        value={pharmacy.did}
                        checked={selectedPharmacy?.did === pharmacy.did}
                        onChange={(e) => {
                          const selected = pharmacies.find(p => p.did === e.target.value);
                          if (selected) {
                            setSelectedPharmacy(selected);
                          }
                        }}
                        className="mr-3"
                      />
                      <div>
                        <p className="font-medium text-white">{pharmacy.name}</p>
                        {pharmacy.address && (
                          <p className="text-sm text-gray-400">{pharmacy.address}</p>
                        )}
                      </div>
                    </label>
                  ))}
                </div>
              )}
              
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => {
                    setShowPharmacyModal(false);
                    setSelectedPharmacy(null);
                    setPrescriptionToShare(null);
                  }}
                  className="px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-600"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmShare}
                  disabled={!selectedPharmacy}
                  className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:bg-gray-400"
                >
                  Share Prescription
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PatientDashboard;
