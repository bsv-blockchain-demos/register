import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { useApp } from '../../context/AppContext';
import { Link } from 'react-router-dom';
import type { PrescriptionCredential } from '../../types';

const InsuranceDashboard: React.FC = () => {
  const { currentUser } = useAuth();
  const { state } = useApp();
  const [claimsToProcess, setClaimsToProcess] = React.useState<PrescriptionCredential[]>([]);
  const [processedClaims, setProcessedClaims] = React.useState<PrescriptionCredential[]>([]);
  const [allPrescriptions, setAllPrescriptions] = React.useState<PrescriptionCredential[]>([]);

  React.useEffect(() => {
    if (currentUser?.type === 'insurance') {
      setAllPrescriptions(state.prescriptions);
      
      // Insurance sees prescriptions from their insurance provider
      const insurancePrescriptions = state.prescriptions.filter(p => 
        p.credentialSubject.patientInfo.insuranceProvider === currentUser.name
      );
      
      // Separate into pending (no dispensado) and processed (dispensado)
      const pending = insurancePrescriptions.filter(p => 
        p.credentialSubject.prescription.status === 'no dispensado'
      );
      setClaimsToProcess(pending);
      
      const processed = insurancePrescriptions.filter(p =>
        p.credentialSubject.prescription.status === 'dispensado'
      );
      setProcessedClaims(processed);
    }
  }, [currentUser, state.prescriptions]);

  const totalClaimAmount = processedClaims.reduce((sum) => {
    // Simplified calculation for demo - $10 per prescription
    return sum + 10;
  }, 0);

  const patientStats = state.actors
    .filter(actor => actor.type === 'patient')
    .map(patient => {
      const patientPrescriptions = allPrescriptions.filter(
        p => p.credentialSubject.id === patient.did
      );
      return {
        patient,
        prescriptionCount: patientPrescriptions.length,
        totalCost: patientPrescriptions.length * 10 // $10 per prescription
      };
    })
    .filter(stat => stat.prescriptionCount > 0);

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-bold">Insurance Dashboard</h1>
            <p className="text-gray-400 mt-2">Welcome, {currentUser?.name}</p>
          </div>
          <Link 
            to="/login"
            className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg transition-colors"
          >
            Logout
          </Link>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-gray-800 rounded-lg p-6">
            <h3 className="text-gray-400 text-sm font-medium">Total Claims</h3>
            <p className="text-3xl font-bold mt-2">{claimsToProcess.length + processedClaims.length}</p>
          </div>
          <div className="bg-gray-800 rounded-lg p-6">
            <h3 className="text-gray-400 text-sm font-medium">Pending Claims</h3>
            <p className="text-3xl font-bold mt-2 text-yellow-500">{claimsToProcess.length}</p>
          </div>
          <div className="bg-gray-800 rounded-lg p-6">
            <h3 className="text-gray-400 text-sm font-medium">Processed Claims</h3>
            <p className="text-3xl font-bold mt-2 text-green-500">{processedClaims.length}</p>
          </div>
          <div className="bg-gray-800 rounded-lg p-6">
            <h3 className="text-gray-400 text-sm font-medium">Total Payout</h3>
            <p className="text-3xl font-bold mt-2">${totalClaimAmount}</p>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Pending Claims */}
          <div className="bg-gray-800 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Pending Claims</h2>
            <div className="space-y-4">
              {claimsToProcess.length === 0 ? (
                <p className="text-gray-400 text-center py-8">
                  No pending claims at the moment
                </p>
              ) : (
                <div className="space-y-4 max-h-96 overflow-y-auto">
                  {claimsToProcess.map((prescription) => {
                    const patient = state.actors.find(a => a.did === prescription.credentialSubject.id);
                    const doctor = state.actors.find(a => a.did === prescription.credentialSubject.prescription.doctorId);
                    const claimAmount = 10; // $10 per prescription
                    
                    return (
                      <div key={prescription.id} className="bg-gray-700 rounded-lg p-4">
                        <div className="space-y-2">
                          <div className="flex-1">
                            <h4 className="font-medium text-white">{prescription.credentialSubject.prescription.medication.name}</h4>
                            <p className="text-sm text-gray-300 mt-1">
                              Patient: {patient?.name || prescription.credentialSubject.patientInfo.name}
                            </p>
                            <p className="text-sm text-gray-300">
                              Doctor: {doctor?.name || 'Unknown'}
                            </p>
                            <p className="text-sm text-gray-400 mt-1">
                              Diagnosis: {prescription.credentialSubject.prescription.diagnosis}
                            </p>
                            <p className="text-sm font-medium text-green-400 mt-2">
                              Claim: ${claimAmount}
                            </p>
                          </div>
                          <div className="flex gap-2 mt-4">
                            <button className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded-lg text-sm transition-colors">
                              Approve Claim
                            </button>
                            <button className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg text-sm transition-colors">
                              Deny Claim
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Processed Claims */}
          <div className="bg-gray-800 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Recent Processed Claims</h2>
            <div className="space-y-4">
              {processedClaims.length === 0 ? (
                <p className="text-gray-400 text-center py-8">
                  No processed claims yet
                </p>
              ) : (
                <div className="space-y-4 max-h-96 overflow-y-auto">
                  {processedClaims.slice(0, 5).map((prescription) => {
                    const patient = state.actors.find(a => a.did === prescription.credentialSubject.id);
                    
                    return (
                      <div key={prescription.id} className="bg-gray-700 rounded-lg p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="font-medium">{prescription.credentialSubject.prescription.medication.name}</h4>
                            <p className="text-sm text-gray-400">
                              Patient: {patient?.name || prescription.credentialSubject.patientInfo.name}
                            </p>
                            <p className="text-sm text-gray-400">
                              Processed: {new Date(prescription.issuanceDate).toLocaleDateString()}
                            </p>
                          </div>
                          <span className="text-green-500 font-medium">$10</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Patient Statistics */}
        <div className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Patient Statistics</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left border-b border-gray-700">
                  <th className="pb-2 text-gray-400">Patient</th>
                  <th className="pb-2 text-gray-400">Prescriptions</th>
                  <th className="pb-2 text-gray-400">Total Cost</th>
                </tr>
              </thead>
              <tbody>
                {patientStats.map((stat) => (
                  <tr key={stat.patient.id} className="border-b border-gray-700">
                    <td className="py-3">{stat.patient.name}</td>
                    <td className="py-3">{stat.prescriptionCount}</td>
                    <td className="py-3">${stat.totalCost}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InsuranceDashboard;
