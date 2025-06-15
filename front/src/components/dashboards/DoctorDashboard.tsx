import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useApp } from '../../context/AppContext';
import { Link } from 'react-router-dom';
import type { PrescriptionCredential, Actor } from '../../types';

const DoctorDashboard: React.FC = () => {
  const { currentUser } = useAuth();
  const { state } = useApp();
  const [prescriptions, setPrescriptions] = useState<PrescriptionCredential[]>([]);
  const [patients, setPatients] = useState<Actor[]>([]);

  useEffect(() => {
    // Filter prescriptions issued by current doctor
    if (currentUser && state.prescriptions) {
      const myPrescriptions = state.prescriptions.filter(
        p => p.doctorDid === currentUser.did
      );
      setPrescriptions(myPrescriptions);
    }

    // Get all patients
    if (state.actors) {
      const allPatients = state.actors.filter(a => a.type === 'patient');
      setPatients(allPatients);
    }
  }, [currentUser, state.prescriptions, state.actors]);

  const todaysPrescriptions = prescriptions.filter(p => {
    const today = new Date().toDateString();
    return new Date(p.issuedDate).toDateString() === today;
  });

  const activePrescriptions = prescriptions.filter(p => p.status === 'active');

  return (
    <div className="min-h-screen bg-gray-900">
      <div className="bg-gray-800 border-b border-gray-700 px-8 py-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Doctor Portal</h1>
            <p className="text-gray-300 mt-1">Welcome, Dr. {currentUser?.name}</p>
          </div>
          <div className="flex items-center gap-4">
            <Link
              to="/prescription"
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
            >
              ➕ New Prescription
            </Link>
          </div>
        </div>
      </div>

      <div className="p-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-gray-300 text-sm font-medium">Today's Prescriptions</h3>
              <span className="text-2xl">📋</span>
            </div>
            <p className="text-3xl font-bold text-white">{todaysPrescriptions.length}</p>
            <p className="text-gray-400 text-sm mt-1">Issued today</p>
          </div>

          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-gray-300 text-sm font-medium">Active Prescriptions</h3>
              <span className="text-2xl">💊</span>
            </div>
            <p className="text-3xl font-bold text-white">{activePrescriptions.length}</p>
            <p className="text-gray-400 text-sm mt-1">Currently active</p>
          </div>

          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-gray-300 text-sm font-medium">Total Patients</h3>
              <span className="text-2xl">👥</span>
            </div>
            <p className="text-3xl font-bold text-white">{patients.length}</p>
            <p className="text-gray-400 text-sm mt-1">Registered patients</p>
          </div>

          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-gray-300 text-sm font-medium">Total Prescriptions</h3>
              <span className="text-2xl">📄</span>
            </div>
            <p className="text-3xl font-bold text-white">{prescriptions.length}</p>
            <p className="text-gray-400 text-sm mt-1">All time</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-gray-800 rounded-lg border border-gray-700">
            <div className="px-6 py-4 border-b border-gray-700">
              <h2 className="text-lg font-semibold text-white">Recent Prescriptions</h2>
            </div>
            <div className="p-6">
              {prescriptions.length === 0 ? (
                <p className="text-gray-400 text-center py-8">No prescriptions issued yet</p>
              ) : (
                <div className="space-y-4 max-h-96 overflow-y-auto">
                  {prescriptions.slice(0, 5).map((prescription) => {
                    const patient = state.actors.find(a => a.did === prescription.patientDid);
                    return (
                      <div key={prescription.id} className="bg-gray-700 rounded-lg p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h4 className="font-medium text-white">{prescription.medication}</h4>
                            <p className="text-sm text-gray-300 mt-1">
                              Patient: {patient?.name || 'Unknown'}
                            </p>
                            <p className="text-sm text-gray-400 mt-1">
                              {prescription.dosage} - {prescription.quantity} units
                            </p>
                            <p className="text-xs text-gray-500 mt-2">
                              {new Date(prescription.issuedDate).toLocaleString()}
                            </p>
                          </div>
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
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="bg-gray-800 rounded-lg border border-gray-700">
            <div className="px-6 py-4 border-b border-gray-700">
              <h2 className="text-lg font-semibold text-white">Quick Actions</h2>
            </div>
            <div className="p-6 space-y-4">
              <Link
                to="/prescription"
                className="block bg-blue-600 hover:bg-blue-700 p-4 rounded-lg transition-colors text-center"
              >
                <h3 className="font-medium text-white">➕ Create New Prescription</h3>
                <p className="text-sm text-blue-100 mt-1">Issue a prescription for a patient</p>
              </Link>
              
              <Link
                to="/actors"
                className="block bg-gray-700 hover:bg-gray-600 p-4 rounded-lg transition-colors group"
              >
                <h3 className="font-medium text-white group-hover:text-blue-400">👥 Manage Patients</h3>
                <p className="text-sm text-gray-400 mt-1">View and manage patient records</p>
              </Link>

              <Link
                to="/prescription-dashboard"
                className="block bg-gray-700 hover:bg-gray-600 p-4 rounded-lg transition-colors group"
              >
                <h3 className="font-medium text-white group-hover:text-blue-400">📊 Prescription Analytics</h3>
                <p className="text-sm text-gray-400 mt-1">View prescription history and statistics</p>
              </Link>

              <Link
                to="/qr-scanner"
                className="block bg-gray-700 hover:bg-gray-600 p-4 rounded-lg transition-colors group"
              >
                <h3 className="font-medium text-white group-hover:text-blue-400">📱 Scan QR Code</h3>
                <p className="text-sm text-gray-400 mt-1">Verify patient credentials</p>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DoctorDashboard;
