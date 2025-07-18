import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useApp } from '../../context/AppContext';
import apiService from '../../services/apiService';
import { FiPackage, FiClock, FiCheckCircle } from 'react-icons/fi';

interface SharedPrescription {
  _id: string;
  prescriptionId: string;
  prescription: {
    credentialSubject: {
      id: string;
      prescription: {
        id: string;
        patientName: string;
        diagnosis: string;
        medicationName: string;
        dosage: string;
        frequency: string;
        duration: string;
        prescribedBy: string;
        prescribedAt: string;
      };
    };
    issuer: string;
    issuanceDate: string;
  };
  patientDid: string;
  pharmacyDid: string;
  sharedAt: string;
  status: 'shared' | 'viewed' | 'dispensed';
}

function PharmacyDashboard() {
  const { currentUser } = useAuth();
  const { state, dispatch } = useApp();
  const [sharedPrescriptions, setSharedPrescriptions] = useState<SharedPrescription[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPrescription, setSelectedPrescription] = useState<SharedPrescription | null>(null);
  const [showDispenseModal, setShowDispenseModal] = useState(false);
  const [dispensingForm, setDispensingForm] = useState({
    medicationProvided: '',
    batchNumber: '',
    expiryDate: '',
    pharmacistNotes: ''
  });

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

  const loadSharedPrescriptions = useCallback(async () => {
    if (!currentUser?.did) return;
    
    try {
      setLoading(true);
      console.log('[PharmacyDashboard] Loading enhanced prescriptions for:', currentUser.did);
      
      // Use enhanced prescriptions endpoint
      const response = await apiService.getEnhancedPrescriptionsByPharmacy(currentUser.did);
      console.log('[PharmacyDashboard] Enhanced API response:', response);
      
      if (response.success && response.data) {
        // Transform enhanced prescription tokens to match existing shared prescription format
        const transformedPrescriptions = response.data.map((token: {
          id: string;
          doctorDid: string;
          patientDid: string;
          createdAt: string;
          updatedAt?: string;
          status: string;
          prescriptionVC?: {
            credentialSubject?: {
              medicationName?: string;
              dosage?: string;
              instructions?: string;
              quantity?: number;
              diagnosis?: string;
            };
          };
        }) => {
          // Extract medication data from prescriptionVC.credentialSubject.prescription
          const credentialSubject = token.prescriptionVC?.credentialSubject || {};
          const prescriptionData = credentialSubject.prescription || {};
          const medicationName = prescriptionData.medicationName || 'Unknown Medication';
          const dosage = prescriptionData.dosage || 'No dosage specified';
          const instructions = prescriptionData.instructions || credentialSubject.instructions || '';
          // Note: quantity is extracted but not used in the current implementation
          
          // Find patient name from actors
          const patient = state.actors?.find(a => a.did === token.patientDid);
          const patientName = patient?.name || 'Unknown Patient';
          
          // Find doctor name from actors
          const doctor = state.actors?.find(a => a.did === token.doctorDid);
          const doctorName = doctor?.name || 'Unknown Doctor';
          
          return {
            _id: token.id,
            prescriptionId: token.id,
            prescription: {
              credentialSubject: {
                id: token.patientDid,
                prescription: {
                  id: token.id,
                  patientName: patientName,
                  diagnosis: prescriptionData.diagnosisCode || credentialSubject.diagnosis || 'No diagnosis',
                  medicationName: medicationName,
                  dosage: dosage,
                  frequency: instructions,
                  duration: '',
                  prescribedBy: doctorName,
                  prescribedAt: token.createdAt
                }
              },
              issuer: token.doctorDid,
              issuanceDate: token.createdAt
            },
            patientDid: token.patientDid,
            pharmacyDid: currentUser.did,
            sharedAt: token.updatedAt || token.createdAt,
            status: token.status === 'dispensed' ? 'dispensed' : 'shared'
          };
        });
        
        console.log('[PharmacyDashboard] Transformed prescriptions:', transformedPrescriptions);
        setSharedPrescriptions(transformedPrescriptions);
      } else {
        console.log('[PharmacyDashboard] No prescriptions found or error:', response);
        setSharedPrescriptions([]);
      }
    } catch (error) {
      console.error('Error loading shared prescriptions:', error);
      setSharedPrescriptions([]);
    } finally {
      setLoading(false);
    }
  }, [currentUser, state.actors]);

  useEffect(() => {
    // Load actors first
    loadActors();
  }, [loadActors]);

  useEffect(() => {
    loadSharedPrescriptions();
  }, [loadSharedPrescriptions]);

  const handleDispensePrescription = (prescription: SharedPrescription) => {
    setSelectedPrescription(prescription);
    setDispensingForm({
      medicationProvided: prescription.prescription.credentialSubject.prescription.medicationName,
      batchNumber: '',
      expiryDate: '',
      pharmacistNotes: ''
    });
    setShowDispenseModal(true);
  };

  const handleConfirmDispense = async () => {
    if (!selectedPrescription || !currentUser) return;

    try {
      const response = await apiService.dispenseEnhancedPrescription(
        selectedPrescription.prescriptionId,
        {
          pharmacyDid: currentUser.did || '',
          batchNumber: dispensingForm.batchNumber,
          manufacturerInfo: dispensingForm.medicationProvided, // Using medicationProvided as manufacturer info
          dispensedQuantity: '1', // Default quantity
          pharmacistSignature: dispensingForm.pharmacistNotes // Using notes as signature for now
        }
      );

      if (response.success) {
        alert('Prescription dispensed successfully!');
        setShowDispenseModal(false);
        setSelectedPrescription(null);
        // Reload prescriptions to update status
        loadSharedPrescriptions();
      } else {
        alert(`Failed to dispense prescription: ${response.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error dispensing prescription:', error);
      alert('Failed to dispense prescription. Please try again.');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white p-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-xl">Loading prescriptions...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Pharmacy Dashboard</h1>
        
        {/* Welcome Section */}
        <div className="bg-gray-800 rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-2">Welcome, {currentUser?.name}</h2>
          <p className="text-gray-400">Pharmacy ID: {currentUser?.did}</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-gray-800 rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Total Shared</p>
                <p className="text-3xl font-bold">{sharedPrescriptions.length}</p>
              </div>
              <FiPackage className="text-blue-500 text-3xl" />
            </div>
          </div>
          <div className="bg-gray-800 rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Pending</p>
                <p className="text-3xl font-bold">
                  {sharedPrescriptions.filter(p => p.status !== 'dispensed').length}
                </p>
              </div>
              <FiClock className="text-yellow-500 text-3xl" />
            </div>
          </div>
          <div className="bg-gray-800 rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Dispensed</p>
                <p className="text-3xl font-bold">
                  {sharedPrescriptions.filter(p => p.status === 'dispensed').length}
                </p>
              </div>
              <FiCheckCircle className="text-green-500 text-3xl" />
            </div>
          </div>
        </div>

        {/* Shared Prescriptions */}
        <div className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Prescriptions Shared with You</h2>
          
          {sharedPrescriptions.length === 0 ? (
            <p className="text-gray-400">No prescriptions have been shared with your pharmacy yet.</p>
          ) : (
            <div className="space-y-4">
              {sharedPrescriptions.map((prescription) => (
                <div key={prescription._id} className="border border-gray-700 rounded-lg p-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-semibold text-lg">
                        {prescription.prescription.credentialSubject.prescription.medicationName}
                      </h3>
                      <p className="text-gray-400">
                        Patient: {prescription.prescription.credentialSubject.prescription.patientName}
                      </p>
                      <p className="text-gray-400">
                        Diagnosis: {prescription.prescription.credentialSubject.prescription.diagnosis}
                      </p>
                      <p className="text-gray-400">
                        Dosage: {prescription.prescription.credentialSubject.prescription.dosage}
                      </p>
                      <p className="text-sm text-gray-500 mt-2">
                        Prescribed by: {prescription.prescription.credentialSubject.prescription.prescribedBy}
                      </p>
                      <p className="text-sm text-gray-500">
                        Shared on: {formatDate(prescription.sharedAt)}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span className={`px-3 py-1 rounded-full text-sm ${
                        prescription.status === 'dispensed'
                          ? 'bg-green-500/20 text-green-500'
                          : 'bg-yellow-500/20 text-yellow-500'
                      }`}>
                        {prescription.status === 'dispensed' ? 'Dispensed' : 'Pending'}
                      </span>
                      {prescription.status !== 'dispensed' && (
                        <button
                          onClick={() => handleDispensePrescription(prescription)}
                          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                        >
                          Dispense
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Dispense Modal */}
      {showDispenseModal && selectedPrescription && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-semibold mb-4">Dispense Prescription</h3>
            
            <div className="mb-4 p-3 bg-gray-700 rounded">
              <p className="font-medium">Patient: {selectedPrescription.prescription.credentialSubject.prescription.patientName}</p>
              <p className="text-sm text-gray-400">Medication: {selectedPrescription.prescription.credentialSubject.prescription.medicationName}</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300">Medication Provided</label>
                <input
                  type="text"
                  value={dispensingForm.medicationProvided}
                  onChange={(e) => setDispensingForm({...dispensingForm, medicationProvided: e.target.value})}
                  className="mt-1 block w-full bg-gray-700 border border-gray-600 rounded-md shadow-sm px-3 py-2 text-white focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300">Batch Number</label>
                <input
                  type="text"
                  value={dispensingForm.batchNumber}
                  onChange={(e) => setDispensingForm({...dispensingForm, batchNumber: e.target.value})}
                  className="mt-1 block w-full bg-gray-700 border border-gray-600 rounded-md shadow-sm px-3 py-2 text-white focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., LOT123456"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300">Expiry Date</label>
                <input
                  type="date"
                  value={dispensingForm.expiryDate}
                  onChange={(e) => setDispensingForm({...dispensingForm, expiryDate: e.target.value})}
                  className="mt-1 block w-full bg-gray-700 border border-gray-600 rounded-md shadow-sm px-3 py-2 text-white focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300">Pharmacist Notes</label>
                <textarea
                  value={dispensingForm.pharmacistNotes}
                  onChange={(e) => setDispensingForm({...dispensingForm, pharmacistNotes: e.target.value})}
                  className="mt-1 block w-full bg-gray-700 border border-gray-600 rounded-md shadow-sm px-3 py-2 text-white focus:ring-blue-500 focus:border-blue-500"
                  rows={3}
                  placeholder="Any special instructions or notes..."
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowDispenseModal(false);
                  setSelectedPrescription(null);
                }}
                className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-500 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDispense}
                disabled={!dispensingForm.medicationProvided}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-500 transition-colors"
              >
                Confirm Dispensation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default PharmacyDashboard;
