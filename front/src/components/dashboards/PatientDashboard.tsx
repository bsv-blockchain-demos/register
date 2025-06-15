import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useApp } from '../../context/AppContext';
import { Link } from 'react-router-dom';
import type { PrescriptionCredential, Actor } from '../../types';
import { apiService } from '../../services/apiService';
import { FiFileText, FiClock, FiCheckCircle, FiAlertCircle } from 'react-icons/fi';

const PatientDashboard: React.FC = () => {
  const { currentUser } = useAuth();
  const { state } = useApp();
  const [prescriptions, setPrescriptions] = useState<PrescriptionCredential[]>([]);
  const [doctors, setDoctors] = useState<Actor[]>([]);
  const [loading, setLoading] = useState(true);

  const loadPrescriptions = useCallback(async () => {
    if (!currentUser?.did) return;
    
    try {
      setLoading(true);
      const response = await apiService.getPrescriptionsByActor(currentUser.did, 'patient');
      if (response.success && response.data) {
        setPrescriptions(response.data);
      }
    } catch (error) {
      console.error('Failed to load prescriptions:', error);
    } finally {
      setLoading(false);
    }
  }, [currentUser?.did]);

  useEffect(() => {
    // Filter prescriptions for current patient
    if (currentUser?.did && state.prescriptions) {
      const myPrescriptions = state.prescriptions.filter(
        p => p.credentialSubject.id === currentUser.did
      );
      setPrescriptions(myPrescriptions);
    }

    // Get all doctors
    if (state.actors) {
      const allDoctors = state.actors.filter(a => a.type === 'doctor');
      setDoctors(allDoctors);
    }

    loadPrescriptions();
  }, [currentUser, state.prescriptions, state.actors, loadPrescriptions]);

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
            <p className="text-3xl font-bold text-white">{dispensedPrescriptions.length}</p>
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
                      const medication = prescriptionData.medication;
                      
                      return (
                        <div key={prescription.id || index} className="border border-gray-700 rounded-lg p-4">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <h4 className="font-medium text-white text-lg">
                                {medication.name}
                              </h4>
                              <p className="text-gray-400 mt-1">
                                <strong>Dosage:</strong> {medication.dosage} | 
                                <strong> Frequency:</strong> {medication.frequency}
                              </p>
                              <p className="text-gray-400">
                                <strong>Duration:</strong> {medication.duration}
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

        {/* All Prescriptions Table */}
        <div className="bg-gray-800 rounded-lg p-6 mt-8">
          <h2 className="text-xl font-bold mb-4">All Prescriptions</h2>
          
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
                  {prescriptions.map((prescription, index) => {
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
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PatientDashboard;
