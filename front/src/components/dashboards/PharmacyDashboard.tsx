import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useApp } from '../../context/AppContext';
import { Link } from 'react-router-dom';
import type { PrescriptionCredential, Actor } from '../../types';
import { apiService } from '../../services/apiService';
import { FiPackage, FiClock, FiCheckCircle, FiAlertCircle, FiTruck } from 'react-icons/fi';

const PharmacyDashboard: React.FC = () => {
  const { currentUser } = useAuth();
  const { state, dispatch } = useApp();
  const [prescriptions, setPrescriptions] = useState<PrescriptionCredential[]>([]);
  const [patients, setPatients] = useState<Actor[]>([]);
  const [doctors, setDoctors] = useState<Actor[]>([]);
  const [loading, setLoading] = useState(true);
  const [dispensing, setDispensing] = useState<string | null>(null);

  const loadPrescriptions = useCallback(async () => {
    try {
      setLoading(true);
      const response = await apiService.getPrescriptions();
      if (response.success && response.data) {
        setPrescriptions(response.data);
      }
    } catch (error) {
      console.error('Failed to load prescriptions:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Load prescriptions from state
    if (state.prescriptions) {
      setPrescriptions(state.prescriptions);
    }

    // Get all patients and doctors
    if (state.actors) {
      const allPatients = state.actors.filter(a => a.type === 'patient');
      const allDoctors = state.actors.filter(a => a.type === 'doctor');
      setPatients(allPatients);
      setDoctors(allDoctors);
    }

    loadPrescriptions();
  }, [state.prescriptions, state.actors, loadPrescriptions]);

  // Filter prescriptions
  const pendingPrescriptions = prescriptions.filter(p => 
    p.credentialSubject.prescription.status === 'no dispensado'
  );

  const dispensedPrescriptions = prescriptions.filter(p => 
    p.credentialSubject.prescription.status === 'dispensado'
  );

  const todayDispensed = dispensedPrescriptions.filter(p => {
    const date = new Date(p.issuanceDate);
    const today = new Date();
    return date.toDateString() === today.toDateString();
  }).length;

  const handleDispense = async (prescriptionId: string) => {
    if (!currentUser?.did) {
      alert('Pharmacy DID not found');
      return;
    }

    try {
      setDispensing(prescriptionId);
      
      const response = await apiService.dispensePrescription(prescriptionId, currentUser.did);
      
      if (response.success) {
        // Update local state
        const updatedPrescriptions = prescriptions.map(p => {
          if (p.id === prescriptionId) {
            return {
              ...p,
              credentialSubject: {
                ...p.credentialSubject,
                prescription: {
                  ...p.credentialSubject.prescription,
                  status: 'dispensado' as const
                }
              }
            };
          }
          return p;
        });
        
        setPrescriptions(updatedPrescriptions);
        dispatch({
          type: 'SET_PRESCRIPTIONS',
          payload: updatedPrescriptions
        });
        
        alert('Prescription dispensed successfully!');
      } else {
        alert(`Failed to dispense prescription: ${response.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error dispensing prescription:', error);
      alert('Failed to dispense prescription');
    } finally {
      setDispensing(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Pharmacy Dashboard</h1>
          <p className="text-gray-400">Welcome back, {currentUser?.name}</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-gray-800 rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-gray-400">Pending</h3>
              <FiAlertCircle className="text-yellow-500 text-2xl" />
            </div>
            <p className="text-3xl font-bold text-white">{pendingPrescriptions.length}</p>
            <p className="text-sm text-gray-500 mt-2">Ready to dispense</p>
          </div>

          <div className="bg-gray-800 rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-gray-400">Total Dispensed</h3>
              <FiCheckCircle className="text-green-500 text-2xl" />
            </div>
            <p className="text-3xl font-bold text-white">{dispensedPrescriptions.length}</p>
            <p className="text-sm text-gray-500 mt-2">All time</p>
          </div>

          <div className="bg-gray-800 rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-gray-400">Today</h3>
              <FiClock className="text-blue-500 text-2xl" />
            </div>
            <p className="text-3xl font-bold text-white">{todayDispensed}</p>
            <p className="text-sm text-gray-500 mt-2">Dispensed today</p>
          </div>

          <div className="bg-gray-800 rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-gray-400">Inventory</h3>
              <FiPackage className="text-purple-500 text-2xl" />
            </div>
            <p className="text-3xl font-bold text-white">OK</p>
            <p className="text-sm text-gray-500 mt-2">Stock status</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Pending Prescriptions */}
          <div className="lg:col-span-2">
            <div className="bg-gray-800 rounded-lg">
              <div className="border-b border-gray-700 p-6">
                <h2 className="text-lg font-semibold text-white">Pending Prescriptions</h2>
              </div>
              <div className="p-6">
                {loading ? (
                  <p className="text-gray-400 text-center py-8">Loading prescriptions...</p>
                ) : pendingPrescriptions.length === 0 ? (
                  <p className="text-gray-400 text-center py-8">No pending prescriptions</p>
                ) : (
                  <div className="space-y-4">
                    {pendingPrescriptions.map((prescription) => {
                      const patient = patients.find(p => p.did === prescription.credentialSubject.id);
                      const doctor = doctors.find(d => d.did === prescription.issuer);
                      const prescriptionData = prescription.credentialSubject.prescription;
                      const medication = prescriptionData.medication;
                      
                      return (
                        <div key={prescription.id} className="border border-gray-700 rounded-lg p-4">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <h4 className="font-medium text-white text-lg">
                                {medication.name}
                              </h4>
                              <p className="text-gray-400 mt-1">
                                <strong>Patient:</strong> {patient?.name || 'Unknown'}
                              </p>
                              <p className="text-gray-400">
                                <strong>Dosage:</strong> {medication.dosage} | 
                                <strong> Frequency:</strong> {medication.frequency}
                              </p>
                              <p className="text-gray-400">
                                <strong>Duration:</strong> {medication.duration}
                              </p>
                              <p className="text-sm text-gray-500 mt-2">
                                <strong>Doctor:</strong> {doctor?.name || 'Unknown'}
                              </p>
                              <p className="text-xs text-gray-600 mt-1">
                                Prescribed: {new Date(prescriptionData.prescribedDate).toLocaleDateString()}
                              </p>
                            </div>
                            <div className="ml-4">
                              <span className="px-3 py-1 rounded-full text-sm font-medium bg-yellow-500/20 text-yellow-500">
                                Pending
                              </span>
                            </div>
                          </div>
                          
                          <div className="mt-4 flex gap-2">
                            <button
                              onClick={() => handleDispense(prescription.id)}
                              disabled={dispensing === prescription.id}
                              className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                            >
                              <FiTruck />
                              {dispensing === prescription.id ? 'Dispensing...' : 'Dispense'}
                            </button>
                            <button className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                              View Details
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Quick Actions & Stats */}
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
                  📱 Scan Prescription QR
                </Link>

                <Link
                  to="/prescription-dashboard"
                  className="block bg-gray-700 hover:bg-gray-600 p-4 rounded-lg transition-colors group"
                >
                  <h3 className="font-medium text-white">📊 All Prescriptions</h3>
                  <p className="text-sm text-gray-400 mt-1">View complete history</p>
                </Link>

                <Link
                  to="/actors"
                  className="block bg-gray-700 hover:bg-gray-600 p-4 rounded-lg transition-colors group"
                >
                  <h3 className="font-medium text-white">👥 Manage Actors</h3>
                  <p className="text-sm text-gray-400 mt-1">View patients & doctors</p>
                </Link>
              </div>
            </div>

            {/* Pharmacy Info */}
            <div className="bg-gray-800 rounded-lg mt-6">
              <div className="p-6">
                <h3 className="text-sm font-medium text-gray-400 mb-2">Pharmacy Information</h3>
                <p className="text-white font-medium">{currentUser?.name}</p>
                <p className="text-xs text-gray-500 mt-1">DID: {currentUser?.did?.slice(0, 20)}...</p>
                <p className="text-xs text-gray-500">License: #PHM-2024-001</p>
              </div>
            </div>

            {/* Recent Activity */}
            <div className="bg-gray-800 rounded-lg mt-6">
              <div className="border-b border-gray-700 p-4">
                <h3 className="text-sm font-medium text-white">Recent Dispensations</h3>
              </div>
              <div className="p-4">
                {dispensedPrescriptions.slice(0, 3).map((prescription, index) => {
                  const patient = patients.find(p => p.did === prescription.credentialSubject.id);
                  return (
                    <div key={index} className="py-2 border-b border-gray-700 last:border-0">
                      <p className="text-sm text-white">
                        {prescription.credentialSubject.prescription.medication.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {patient?.name || 'Unknown'} • {new Date(prescription.issuanceDate).toLocaleTimeString()}
                      </p>
                    </div>
                  );
                })}
                {dispensedPrescriptions.length === 0 && (
                  <p className="text-sm text-gray-500">No recent dispensations</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Dispensed Prescriptions Table */}
        <div className="bg-gray-800 rounded-lg p-6 mt-8">
          <h2 className="text-xl font-bold mb-4">Dispensed Prescriptions</h2>
          
          {dispensedPrescriptions.length === 0 ? (
            <p className="text-gray-400">No dispensed prescriptions yet</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-700">
                    <th className="text-left py-3 px-4 text-gray-400">Patient</th>
                    <th className="text-left py-3 px-4 text-gray-400">Medication</th>
                    <th className="text-left py-3 px-4 text-gray-400">Doctor</th>
                    <th className="text-left py-3 px-4 text-gray-400">Dispensed</th>
                    <th className="text-left py-3 px-4 text-gray-400">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {dispensedPrescriptions.map((prescription, index) => {
                    const patient = patients.find(p => p.did === prescription.credentialSubject.id);
                    const doctor = doctors.find(d => d.did === prescription.issuer);
                    const prescriptionData = prescription.credentialSubject.prescription;
                    
                    return (
                      <tr key={index} className="border-b border-gray-700">
                        <td className="py-3 px-4">
                          <p className="font-medium text-white">{patient?.name || 'Unknown'}</p>
                          <p className="text-xs text-gray-500">{patient?.insuranceProvider || 'No insurance'}</p>
                        </td>
                        <td className="py-3 px-4">
                          <p className="text-white">{prescriptionData.medication.name}</p>
                          <p className="text-sm text-gray-400">{prescriptionData.medication.dosage}</p>
                        </td>
                        <td className="py-3 px-4 text-gray-300">
                          {doctor?.name || 'Unknown'}
                        </td>
                        <td className="py-3 px-4 text-gray-300">
                          {new Date(prescription.issuanceDate).toLocaleDateString()}
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-1 rounded text-xs bg-green-500/20 text-green-500">
                            Dispensed
                          </span>
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

export default PharmacyDashboard;
