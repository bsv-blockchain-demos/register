import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useApp } from '../../context/AppContext';
import { Link } from 'react-router-dom';
import type { PrescriptionCredential, Actor } from '../../types';
import { PrescriptionForm } from '../PrescriptionForm';
import { apiService } from '../../services/apiService';
import { FiFileText, FiPlus, FiUser, FiCalendar } from 'react-icons/fi';

interface PrescriptionToken {
  id: string;
  txid: string;
  vout: number;
  satoshis: number;
  status: 'created' | 'dispensing' | 'dispensed' | 'confirmed' | 'expired';
  prescriptionDid: string;
  patientDid: string;
  doctorDid: string;
  pharmacyDid?: string;
  insuranceDid?: string;
  metadata: {
    medicationName: string;
    dosage: string;
    quantity: number;
    instructions: string;
    diagnosisCode?: string;
    batchNumber?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

const DoctorDashboard: React.FC = () => {
  const { currentUser } = useAuth();
  const { state } = useApp();
  const [prescriptions, setPrescriptions] = useState<PrescriptionCredential[]>([]);
  const [patients, setPatients] = useState<Actor[]>([]);
  const [showPrescriptionForm, setShowPrescriptionForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [creatingTestPrescription, setCreatingTestPrescription] = useState(false);

  const loadEnhancedPrescriptions = useCallback(async () => {
    if (!currentUser?.did) return;
    
    try {
      setLoading(true);
      const response = await apiService.getEnhancedPrescriptionsByDoctor(currentUser.did);
      if (response.success && response.data) {
        // Transform enhanced prescription tokens to match existing prescription format
        const transformedPrescriptions = response.data.map((token: PrescriptionToken) => ({
          id: token.id,
          issuer: token.doctorDid,
          issuanceDate: token.createdAt,
          credentialSubject: {
            id: token.patientDid,
            patientInfo: {
              name: 'Patient' // This would come from the actual patient data
            },
            prescription: {
              id: token.id,
              medication: {
                name: token.metadata.medicationName,
                dosage: token.metadata.dosage
              },
              status: token.status === 'confirmed' ? 'dispensado' : 'no dispensado'
            }
          }
        }));
        setPrescriptions(transformedPrescriptions);
      }
    } catch (error) {
      console.error('Failed to load enhanced prescriptions:', error);
    } finally {
      setLoading(false);
    }
  }, [currentUser?.did]);

  useEffect(() => {
    // Get all patients for the form
    if (state.actors) {
      const allPatients = state.actors.filter(a => a.type === 'patient');
      setPatients(allPatients);
    }

    // Load enhanced prescriptions with BSV tokens
    loadEnhancedPrescriptions();
  }, [currentUser, state.actors, loadEnhancedPrescriptions]);

  const createTestPrescription = async () => {
    if (!currentUser?.did) {
      alert('Doctor DID not found');
      return;
    }

    const testPatient = patients[0];
    if (!testPatient) {
      alert('No patient found to create prescription for');
      return;
    }

    setCreatingTestPrescription(true);
    try {
      const prescriptionData = {
        doctorDid: currentUser.did,
        patientDid: testPatient.did!,
        medicationName: 'Amoxicillin',
        dosage: '500mg',
        quantity: '21', // 7 days * 3 times daily
        instructions: 'Take with food. Complete the full course even if symptoms improve. Three times daily for 7 days.',
        diagnosisCode: 'J00', // ICD-10 code for acute nasopharyngitis (common cold)
        insuranceDid: testPatient.insuranceProvider || undefined,
        expiryHours: '720' // 30 days
      };

      const response = await apiService.createEnhancedPrescription(prescriptionData);
      
      if (response.success && response.data) {
        alert('Test prescription created successfully with BSV token!');
        // Reload prescriptions using enhanced endpoint
        await loadEnhancedPrescriptions();
      } else {
        alert(`Failed to create prescription: ${response.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error creating test prescription:', error);
      alert('Failed to create test prescription');
    } finally {
      setCreatingTestPrescription(false);
    }
  };

  const todaysPrescriptions = prescriptions.filter(p => {
    const today = new Date().toDateString();
    return new Date(p.issuanceDate).toDateString() === today;
  });

  const activePrescriptions = prescriptions.filter(p => 
    p.credentialSubject.prescription.status === 'no dispensado'
  );

  const dispensedPrescriptions = prescriptions.filter(p => 
    p.credentialSubject.prescription.status === 'dispensado'
  );

  const recentPrescriptions = [...prescriptions]
    .sort((a, b) => new Date(b.issuanceDate).getTime() - new Date(a.issuanceDate).getTime())
    .slice(0, 5);

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Doctor Dashboard</h1>
          <p className="text-gray-400">Welcome, Dr. {currentUser?.name}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          {/* Today's Prescriptions */}
          <div className="bg-gray-800 rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-gray-400">Today's Prescriptions</h3>
              <span className="text-blue-500">📋</span>
            </div>
            <p className="text-3xl font-bold text-white">{todaysPrescriptions.length}</p>
            <p className="text-sm text-gray-500 mt-2">Issued today</p>
          </div>

          {/* Active Prescriptions */}
          <div className="bg-gray-800 rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-gray-400">Active Prescriptions</h3>
              <span className="text-green-500">✓</span>
            </div>
            <p className="text-3xl font-bold text-white">{activePrescriptions.length}</p>
            <p className="text-sm text-gray-500 mt-2">Not yet dispensed</p>
          </div>

          {/* Dispensed Prescriptions */}
          <div className="bg-gray-800 rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-gray-400">Dispensed</h3>
              <span className="text-purple-500">💊</span>
            </div>
            <p className="text-3xl font-bold text-white">{dispensedPrescriptions.length}</p>
            <p className="text-sm text-gray-500 mt-2">Completed prescriptions</p>
          </div>

          {/* Total Patients */}
          <div className="bg-gray-800 rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-gray-400">Total Patients</h3>
              <span className="text-yellow-500">👥</span>
            </div>
            <p className="text-3xl font-bold text-white">{patients.length}</p>
            <p className="text-sm text-gray-500 mt-2">Registered patients</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Recent Prescriptions */}
          <div className="lg:col-span-2">
            <div className="bg-gray-800 rounded-lg">
              <div className="border-b border-gray-700 p-6">
                <h2 className="text-lg font-semibold text-white">Recent Prescriptions</h2>
              </div>
              <div className="p-6">
                {recentPrescriptions.length === 0 ? (
                  <p className="text-gray-400 text-center py-8">No prescriptions yet</p>
                ) : (
                  <div className="space-y-4">
                    {recentPrescriptions.map((prescription, index) => {
                      const patient = patients.find(p => p.did === prescription.credentialSubject.id);
                      return (
                        <div key={prescription.id || index} className="border border-gray-700 rounded-lg p-4">
                          <div className="flex justify-between items-start">
                            <div>
                              <h4 className="font-medium text-white">
                                {patient?.name || 'Unknown Patient'}
                              </h4>
                              <p className="text-sm text-gray-400 mt-1">
                                💊 {prescription.credentialSubject.prescription.medication.name} - 
                                {prescription.credentialSubject.prescription.medication.dosage}
                              </p>
                              <p className="text-xs text-gray-500 mt-2">
                                {new Date(prescription.issuanceDate).toLocaleDateString()}
                              </p>
                            </div>
                            <span className={`px-2 py-1 text-xs rounded ${
                              prescription.credentialSubject.prescription.status === 'no dispensado' 
                                ? 'bg-yellow-500/20 text-yellow-500' 
                                : 'bg-green-500/20 text-green-500'
                            }`}>
                              {prescription.credentialSubject.prescription.status}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div>
            <div className="bg-gray-800 rounded-lg p-6 mb-8">
              <h2 className="text-xl font-bold mb-4">Quick Actions</h2>
              <div className="flex gap-4">
                <button
                  onClick={() => setShowPrescriptionForm(true)}
                  className="bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded-lg flex items-center gap-2 transition-colors"
                >
                  <FiPlus /> Create Prescription
                </button>
                {patients.length > 0 && (
                  <button
                    onClick={createTestPrescription}
                    disabled={creatingTestPrescription}
                    className="bg-green-600 hover:bg-green-700 px-6 py-3 rounded-lg flex items-center gap-2 transition-colors disabled:bg-gray-600 disabled:cursor-not-allowed"
                  >
                    {creatingTestPrescription ? 'Creating...' : 'Create Test Prescription'}
                  </button>
                )}
              </div>
            </div>

            {/* Doctor Info */}
            <div className="bg-gray-800 rounded-lg mt-6">
              <div className="p-6">
                <h3 className="text-sm font-medium text-gray-400 mb-2">Your Information</h3>
                <p className="text-white font-medium">{currentUser?.name}</p>
                <p className="text-xs text-gray-500 mt-1">{currentUser?.specialization || 'General Practitioner'}</p>
                <p className="text-xs text-gray-500">License: {currentUser?.licenseNumber || 'N/A'}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Prescription Form Modal */}
        {showPrescriptionForm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-900 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-bold">Create New Prescription</h2>
                  <button
                    onClick={() => setShowPrescriptionForm(false)}
                    className="text-gray-400 hover:text-white"
                  >
                    ✕
                  </button>
                </div>
                <PrescriptionForm />
              </div>
            </div>
          </div>
        )}

        {/* Additional Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
          <div className="bg-gray-800 rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Total Prescriptions</p>
                <p className="text-3xl font-bold">{prescriptions.length}</p>
              </div>
              <FiFileText className="text-blue-500 text-3xl" />
            </div>
          </div>
          <div className="bg-gray-800 rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Active Prescriptions</p>
                <p className="text-3xl font-bold">
                  {prescriptions.filter(p => p.credentialSubject.prescription.status === 'no dispensado').length}
                </p>
              </div>
              <FiUser className="text-green-500 text-3xl" />
            </div>
          </div>
          <div className="bg-gray-800 rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">This Month</p>
                <p className="text-3xl font-bold">
                  {prescriptions.filter(p => {
                    const date = new Date(p.issuanceDate);
                    const now = new Date();
                    return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
                  }).length}
                </p>
              </div>
              <FiCalendar className="text-purple-500 text-3xl" />
            </div>
          </div>
        </div>

        {/* Recent Prescriptions Table */}
        <div className="bg-gray-800 rounded-lg p-6 mt-8">
          <h2 className="text-xl font-bold mb-4">All Prescriptions</h2>
          
          {loading ? (
            <p className="text-gray-400">Loading prescriptions...</p>
          ) : prescriptions.length === 0 ? (
            <p className="text-gray-400">No prescriptions found</p>
          ) : (
            <div className="space-y-4">
              {prescriptions.slice(0, 10).map((prescription) => {
                const patient = patients.find(p => p.did === prescription.credentialSubject.id);
                return (
                  <div key={prescription.id} className="border border-gray-700 rounded-lg p-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-semibold text-lg">
                          {prescription.credentialSubject.prescription.medication.name}
                        </h3>
                        <p className="text-gray-400">
                          Patient: {patient?.name || prescription.credentialSubject.patientInfo.name}
                        </p>
                        <p className="text-gray-400">
                          Dosage: {prescription.credentialSubject.prescription.medication.dosage}
                        </p>
                        <p className="text-sm text-gray-500 mt-2">
                          Issued: {new Date(prescription.issuanceDate).toLocaleDateString()}
                        </p>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-sm ${
                        prescription.credentialSubject.prescription.status === 'dispensado'
                          ? 'bg-green-500/20 text-green-500'
                          : 'bg-yellow-500/20 text-yellow-500'
                      }`}>
                        {prescription.credentialSubject.prescription.status === 'dispensado' ? 'Dispensed' : 'Active'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DoctorDashboard;
