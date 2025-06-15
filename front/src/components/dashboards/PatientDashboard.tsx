import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useApp } from '../../context/AppContext';
import { Link } from 'react-router-dom';
import type { PrescriptionCredential } from '../../types';

const PatientDashboard: React.FC = () => {
  const { currentUser } = useAuth();
  const { state } = useApp();
  const [prescriptions, setPrescriptions] = useState<PrescriptionCredential[]>([]);

  useEffect(() => {
    // Filter prescriptions for current patient
    if (currentUser && state.prescriptions) {
      const myPrescriptions = state.prescriptions.filter(
        p => p.patientDid === currentUser.did
      );
      setPrescriptions(myPrescriptions);
    }
  }, [currentUser, state.prescriptions]);

  const activePrescriptions = prescriptions.filter(p => p.status === 'active');
  const dispensedPrescriptions = prescriptions.filter(p => p.status === 'dispensed');
  const completedPrescriptions = prescriptions.filter(p => p.status === 'completed');

  return (
    <div className="min-h-screen bg-gray-900">
      <div className="bg-gray-800 border-b border-gray-700 px-8 py-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Patient Portal</h1>
            <p className="text-gray-300 mt-1">Welcome back, {currentUser?.name}</p>
          </div>
          <div className="flex items-center gap-4">
            <Link
              to="/qr-scanner"
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
            >
              📱 Scan QR Code
            </Link>
          </div>
        </div>
      </div>

      <div className="p-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-gray-300 text-sm font-medium">Active Prescriptions</h3>
              <span className="text-2xl">💊</span>
            </div>
            <p className="text-3xl font-bold text-white">{activePrescriptions.length}</p>
            <p className="text-gray-400 text-sm mt-1">Ready for pickup</p>
          </div>

          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-gray-300 text-sm font-medium">Dispensed</h3>
              <span className="text-2xl">📋</span>
            </div>
            <p className="text-3xl font-bold text-white">{dispensedPrescriptions.length}</p>
            <p className="text-gray-400 text-sm mt-1">Awaiting confirmation</p>
          </div>

          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-gray-300 text-sm font-medium">Completed</h3>
              <span className="text-2xl">✅</span>
            </div>
            <p className="text-3xl font-bold text-white">{completedPrescriptions.length}</p>
            <p className="text-gray-400 text-sm mt-1">Total prescriptions</p>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-gray-800 rounded-lg border border-gray-700">
            <div className="px-6 py-4 border-b border-gray-700">
              <h2 className="text-lg font-semibold text-white">My Prescriptions</h2>
            </div>
            <div className="p-6">
              {prescriptions.length === 0 ? (
                <p className="text-gray-400 text-center py-8">No prescriptions found</p>
              ) : (
                <div className="space-y-4">
                  {prescriptions.map((prescription) => (
                    <div key={prescription.id} className="bg-gray-700 rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="font-medium text-white">{prescription.medication}</h4>
                          <p className="text-sm text-gray-300 mt-1">
                            {prescription.dosage} - {prescription.quantity} units
                          </p>
                          <p className="text-sm text-gray-400 mt-2">
                            Prescribed: {new Date(prescription.issuedDate).toLocaleDateString()}
                          </p>
                          <p className="text-sm text-gray-400">
                            Expires: {new Date(prescription.expiryDate).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="ml-4">
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                            prescription.status === 'active' 
                              ? 'bg-green-500/20 text-green-400 border border-green-500/50'
                              : prescription.status === 'dispensed'
                              ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/50'
                              : 'bg-gray-500/20 text-gray-400 border border-gray-500/50'
                          }`}>
                            {prescription.status}
                          </span>
                        </div>
                      </div>
                      {prescription.status === 'dispensed' && (
                        <div className="mt-4">
                          <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                            Confirm Receipt
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="bg-gray-800 rounded-lg border border-gray-700">
            <div className="px-6 py-4 border-b border-gray-700">
              <h2 className="text-lg font-semibold text-white">Quick Actions</h2>
            </div>
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              <Link
                to="/prescription-dashboard"
                className="bg-gray-700 hover:bg-gray-600 p-4 rounded-lg transition-colors group"
              >
                <h3 className="font-medium text-white group-hover:text-blue-400">View All Prescriptions</h3>
                <p className="text-sm text-gray-400 mt-1">See detailed prescription history</p>
              </Link>
              <Link
                to="/did-resolver"
                className="bg-gray-700 hover:bg-gray-600 p-4 rounded-lg transition-colors group"
              >
                <h3 className="font-medium text-white group-hover:text-blue-400">Verify Credentials</h3>
                <p className="text-sm text-gray-400 mt-1">Check DID documents and VCs</p>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PatientDashboard;
