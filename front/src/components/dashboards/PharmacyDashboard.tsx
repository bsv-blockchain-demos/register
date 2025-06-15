import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { useApp } from '../../context/AppContext';
import { Link } from 'react-router-dom';

const PharmacyDashboard: React.FC = () => {
  const { currentUser } = useAuth();
  const { state } = useApp();

  // Filter prescriptions based on pharmacy perspective
  const pendingPrescriptions = state.prescriptions.filter(p => {
    // Show prescriptions that are not yet dispensed
    return p.credentialSubject.prescription.status === 'no dispensado';
  });

  const dispensedPrescriptions = state.prescriptions.filter(p => {
    // Show prescriptions that are dispensed
    return p.credentialSubject.prescription.status === 'dispensado';
  });

  // Stats
  const totalDispensed = dispensedPrescriptions.length;
  const pendingCount = pendingPrescriptions.length;
  const todayDispensed = dispensedPrescriptions.filter(p => {
    // Use issuanceDate as a proxy for dispensed date
    const dispensedDate = new Date(p.issuanceDate);
    const today = new Date();
    return dispensedDate.toDateString() === today.toDateString();
  }).length;

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Pharmacy Dashboard
          </h1>
          <p className="text-gray-600">
            Welcome, {currentUser?.name || 'Pharmacist'}
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Pending Prescriptions</p>
                <p className="text-3xl font-bold text-gray-900">{pendingCount}</p>
              </div>
              <div className="p-3 bg-yellow-100 rounded-full">
                <svg className="w-8 h-8 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Dispensed</p>
                <p className="text-3xl font-bold text-gray-900">{totalDispensed}</p>
              </div>
              <div className="p-3 bg-green-100 rounded-full">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Today's Dispensations</p>
                <p className="text-3xl font-bold text-gray-900">{todayDispensed}</p>
              </div>
              <div className="p-3 bg-blue-100 rounded-full">
                <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Pending Prescriptions */}
        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Pending Prescriptions</h2>
          {pendingPrescriptions.length === 0 ? (
            <p className="text-gray-500">No pending prescriptions to dispense.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Patient
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Doctor
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Medication
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Details
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {pendingPrescriptions.map((prescription, index) => {
                    const doctor = state.actors.find(a => a.did === prescription.credentialSubject.prescription.doctorId);
                    return (
                      <tr key={index}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {prescription.credentialSubject.patientInfo.name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {doctor?.name || prescription.credentialSubject.prescription.doctorId}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {prescription.credentialSubject.prescription.medication.name}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          <div>
                            <p>Dosage: {prescription.credentialSubject.prescription.medication.dosage}</p>
                            <p>Frequency: {prescription.credentialSubject.prescription.medication.frequency}</p>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {new Date(prescription.credentialSubject.prescription.prescribedDate).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <button className="text-indigo-600 hover:text-indigo-900 mr-4">
                            Dispense
                          </button>
                          <button className="text-gray-600 hover:text-gray-900">
                            View
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

        {/* Dispensed Prescriptions */}
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Dispensed Prescriptions</h2>
          {dispensedPrescriptions.length === 0 ? (
            <p className="text-gray-500">No dispensed prescriptions yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Patient
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Medication
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Dosage
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Dispensed Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {dispensedPrescriptions.map((prescription, index) => (
                    <tr key={index}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {prescription.credentialSubject.patientInfo.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {prescription.credentialSubject.prescription.medication.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {prescription.credentialSubject.prescription.medication.dosage}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(prescription.issuanceDate).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                          Dispensado
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="mt-8 flex space-x-4">
          <Link
            to="/qr-scanner"
            className="bg-indigo-600 text-white px-6 py-3 rounded-md hover:bg-indigo-700 transition-colors"
          >
            Scan Prescription QR
          </Link>
          <Link
            to="/actors"
            className="bg-gray-600 text-white px-6 py-3 rounded-md hover:bg-gray-700 transition-colors"
          >
            Manage Actors
          </Link>
        </div>
      </div>
    </div>
  );
};

export default PharmacyDashboard;
