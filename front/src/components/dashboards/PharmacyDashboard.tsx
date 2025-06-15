import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import apiService from '../../services/apiService';

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

  const loadSharedPrescriptions = useCallback(async () => {
    if (!currentUser?.did) return;
    
    try {
      setLoading(true);
      const response = await apiService.getSharedPrescriptions(currentUser.did);
      if (response.success && response.data) {
        setSharedPrescriptions(response.data);
      }
    } catch (error) {
      console.error('Error loading shared prescriptions:', error);
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

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
      const response = await apiService.createDispensation(
        selectedPrescription.prescriptionId,
        {
          pharmacyDid: currentUser.did || '',
          ...dispensingForm
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
      <div className="flex items-center justify-center h-64">
        <div className="text-xl">Loading prescriptions...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-gray-800 mb-6">Pharmacy Dashboard</h1>
      
      {/* Welcome Section */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-2">Welcome, {currentUser?.name}</h2>
        <p className="text-gray-600">Pharmacy ID: {currentUser?.did}</p>
      </div>

      {/* Shared Prescriptions */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Prescriptions Shared with You</h2>
        
        {sharedPrescriptions.length === 0 ? (
          <p className="text-gray-600">No prescriptions have been shared with your pharmacy yet.</p>
        ) : (
          <div className="grid gap-4">
            {sharedPrescriptions.map((shared) => {
              const prescription = shared.prescription.credentialSubject.prescription;
              return (
                <div key={shared._id} className="border rounded-lg p-4 hover:bg-gray-50">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg">{prescription.patientName}</h3>
                      <div className="mt-2 space-y-1 text-sm text-gray-600">
                        <p><span className="font-medium">Prescription ID:</span> {prescription.id}</p>
                        <p><span className="font-medium">Diagnosis:</span> {prescription.diagnosis}</p>
                        <p><span className="font-medium">Medication:</span> {prescription.medicationName}</p>
                        <p><span className="font-medium">Dosage:</span> {prescription.dosage}</p>
                        <p><span className="font-medium">Frequency:</span> {prescription.frequency}</p>
                        <p><span className="font-medium">Duration:</span> {prescription.duration}</p>
                        <p><span className="font-medium">Prescribed By:</span> Dr. {prescription.prescribedBy}</p>
                        <p><span className="font-medium">Prescribed Date:</span> {formatDate(prescription.prescribedAt)}</p>
                        <p><span className="font-medium">Shared on:</span> {formatDate(shared.sharedAt)}</p>
                      </div>
                    </div>
                    <div className="ml-4 flex flex-col gap-2">
                      <span className={`px-3 py-1 rounded-full text-sm ${
                        shared.status === 'dispensed' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {shared.status === 'dispensed' ? 'Dispensed' : 'Pending'}
                      </span>
                      {shared.status !== 'dispensed' && (
                        <button
                          onClick={() => handleDispensePrescription(shared)}
                          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                        >
                          Dispense
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="text-sm font-medium text-gray-500">Total Shared</h3>
          <p className="text-2xl font-bold text-gray-800">{sharedPrescriptions.length}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="text-sm font-medium text-gray-500">Pending</h3>
          <p className="text-2xl font-bold text-yellow-600">
            {sharedPrescriptions.filter(p => p.status !== 'dispensed').length}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="text-sm font-medium text-gray-500">Dispensed</h3>
          <p className="text-2xl font-bold text-green-600">
            {sharedPrescriptions.filter(p => p.status === 'dispensed').length}
          </p>
        </div>
      </div>

      {/* Dispense Modal */}
      {showDispenseModal && selectedPrescription && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-semibold mb-4">Dispense Prescription</h3>
            
            <div className="mb-4 p-3 bg-gray-100 rounded">
              <p className="font-medium">Patient: {selectedPrescription.prescription.credentialSubject.prescription.patientName}</p>
              <p className="text-sm text-gray-600">Medication: {selectedPrescription.prescription.credentialSubject.prescription.medicationName}</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Medication Provided</label>
                <input
                  type="text"
                  value={dispensingForm.medicationProvided}
                  onChange={(e) => setDispensingForm({...dispensingForm, medicationProvided: e.target.value})}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Batch Number</label>
                <input
                  type="text"
                  value={dispensingForm.batchNumber}
                  onChange={(e) => setDispensingForm({...dispensingForm, batchNumber: e.target.value})}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., LOT123456"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Expiry Date</label>
                <input
                  type="date"
                  value={dispensingForm.expiryDate}
                  onChange={(e) => setDispensingForm({...dispensingForm, expiryDate: e.target.value})}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Pharmacist Notes</label>
                <textarea
                  value={dispensingForm.pharmacistNotes}
                  onChange={(e) => setDispensingForm({...dispensingForm, pharmacistNotes: e.target.value})}
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
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
                className="px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-600"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDispense}
                disabled={!dispensingForm.medicationProvided}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-400"
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
