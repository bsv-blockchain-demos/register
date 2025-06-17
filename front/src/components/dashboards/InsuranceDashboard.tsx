import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useApp } from '../../context/AppContext';
import { Link } from 'react-router-dom';
import type { PrescriptionCredential, Actor } from '../../types';
import { FiFileText, FiClock, FiCheckCircle, FiAlertCircle, FiTrendingUp } from 'react-icons/fi';

interface Dispensation {
  id: string;
  prescriptionId: string;
  pharmacyDid: string;
  dispensedAt: string;
  batchNumber?: string;
  quantity?: number;
  vcId?: string;
}

interface Confirmation {
  id: string;
  prescriptionId: string;
  patientDid: string;
  confirmedAt: string;
  vcId?: string;
}

interface EnhancedPrescription extends PrescriptionCredential {
  status: 'active' | 'dispensed' | 'confirmed';
  dispensation?: Dispensation;
  confirmation?: Confirmation;
  sharedWithPharmacy?: string;
  sharedAt?: string;
}

interface InsuranceStats {
  totalPrescriptions: number;
  dispensed: number;
  confirmed: number;
  pending: number;
  medicationBreakdown: Record<string, number>;
  monthlyBreakdown: Record<string, number>;
}

const InsuranceDashboard: React.FC = () => {
  const { currentUser } = useAuth();
  const { state } = useApp();
  const [prescriptions, setPrescriptions] = useState<EnhancedPrescription[]>([]);
  const [statistics, setStatistics] = useState<InsuranceStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [doctors, setDoctors] = useState<Actor[]>([]);
  const [patients, setPatients] = useState<Actor[]>([]);
  const [pharmacies, setPharmacies] = useState<Actor[]>([]);

  useEffect(() => {
    // Get all actors
    if (state.actors) {
      setDoctors(state.actors.filter(a => a.type === 'doctor'));
      setPatients(state.actors.filter(a => a.type === 'patient'));
      setPharmacies(state.actors.filter(a => a.type === 'pharmacy'));
    }
  }, [state.actors]);

  useEffect(() => {
    const loadInsuranceData = async () => {
      if (!currentUser?.name) return;
      
      try {
        setLoading(true);
        
        // Fetch prescriptions for this insurance provider
        const prescriptionsResponse = await fetch(
          `http://localhost:3000/v1/prescriptions/insurance/${encodeURIComponent(currentUser.name)}`,
          {
            headers: {
              'Accept': 'application/json',
              'Content-Type': 'application/json'
            }
          }
        );
        
        if (prescriptionsResponse.ok) {
          const prescriptionsData = await prescriptionsResponse.json();
          if (prescriptionsData.success) {
            setPrescriptions(prescriptionsData.data);
          }
        }
        
        // Fetch statistics
        const statsResponse = await fetch(
          `http://localhost:3000/v1/prescriptions/insurance/${encodeURIComponent(currentUser.name)}/stats`,
          {
            headers: {
              'Accept': 'application/json',
              'Content-Type': 'application/json'
            }
          }
        );
        
        if (statsResponse.ok) {
          const statsData = await statsResponse.json();
          if (statsData.success) {
            setStatistics(statsData.statistics);
          }
        }
      } catch (error) {
        console.error('Failed to load insurance data:', error);
      } finally {
        setLoading(false);
      }
    };
    
    if (currentUser?.type === 'insurance') {
      loadInsuranceData();
    }
  }, [currentUser]);

  const activePrescriptions = prescriptions.filter(p => p.status === 'active');
  const dispensedPrescriptions = prescriptions.filter(p => p.status === 'dispensed');
  const confirmedPrescriptions = prescriptions.filter(p => p.status === 'confirmed');

  const totalClaimAmount = confirmedPrescriptions.length * 50; // $50 per confirmed prescription

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
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
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">
          <div className="bg-gray-800 rounded-lg p-6">
            <div className="flex justify-between items-start">
              <h3 className="text-gray-400">Total Prescriptions</h3>
              <FiFileText className="text-blue-500 text-2xl" />
            </div>
            <p className="text-3xl font-bold text-white">{prescriptions.length}</p>
            <p className="text-sm text-gray-500 mt-2">All time</p>
          </div>
          
          <div className="bg-gray-800 rounded-lg p-6">
            <div className="flex justify-between items-start">
              <h3 className="text-gray-400">Active</h3>
              <FiClock className="text-yellow-500 text-2xl" />
            </div>
            <p className="text-3xl font-bold text-white">{activePrescriptions.length}</p>
            <p className="text-sm text-gray-500 mt-2">Not dispensed</p>
          </div>
          
          <div className="bg-gray-800 rounded-lg p-6">
            <div className="flex justify-between items-start">
              <h3 className="text-gray-400">Dispensed</h3>
              <FiAlertCircle className="text-orange-500 text-2xl" />
            </div>
            <p className="text-3xl font-bold text-white">{dispensedPrescriptions.length}</p>
            <p className="text-sm text-gray-500 mt-2">Awaiting confirmation</p>
          </div>
          
          <div className="bg-gray-800 rounded-lg p-6">
            <div className="flex justify-between items-start">
              <h3 className="text-gray-400">Confirmed</h3>
              <FiCheckCircle className="text-green-500 text-2xl" />
            </div>
            <p className="text-3xl font-bold text-white">{confirmedPrescriptions.length}</p>
            <p className="text-sm text-gray-500 mt-2">Completed claims</p>
          </div>
          
          <div className="bg-gray-800 rounded-lg p-6">
            <div className="flex justify-between items-start">
              <h3 className="text-gray-400">Total Claims</h3>
              <FiTrendingUp className="text-green-500 text-2xl" />
            </div>
            <p className="text-3xl font-bold text-white">${totalClaimAmount}</p>
            <p className="text-sm text-gray-500 mt-2">Approved payouts</p>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Recent Active Prescriptions */}
          <div className="bg-gray-800 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center">
              <FiClock className="mr-2 text-yellow-500" />
              Recent Active Prescriptions
            </h2>
            {loading ? (
              <p className="text-gray-400">Loading...</p>
            ) : activePrescriptions.length === 0 ? (
              <p className="text-gray-400 text-center py-8">No active prescriptions</p>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {activePrescriptions.slice(0, 5).map((prescription) => {
                  const patient = patients.find(p => p.did === prescription.credentialSubject.id);
                  const doctor = doctors.find(d => d.did === prescription.issuer);
                  const prescriptionData = prescription.credentialSubject.prescription;
                  
                  return (
                    <div key={prescription.id} className="bg-gray-700 rounded-lg p-4">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <h4 className="font-medium text-white">{prescriptionData.medication.name}</h4>
                          <p className="text-sm text-gray-400">
                            Patient: {patient?.name || prescription.credentialSubject.patientInfo.name}
                          </p>
                          <p className="text-sm text-gray-400">
                            Doctor: {doctor?.name || 'Unknown'}
                          </p>
                          <p className="text-sm text-gray-400">
                            Prescribed: {new Date(prescription.issuanceDate).toLocaleDateString()}
                          </p>
                        </div>
                        <span className="px-2 py-1 bg-yellow-500/20 text-yellow-500 rounded text-xs">
                          Active
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Recent Confirmed Claims */}
          <div className="bg-gray-800 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center">
              <FiCheckCircle className="mr-2 text-green-500" />
              Recent Confirmed Claims
            </h2>
            {loading ? (
              <p className="text-gray-400">Loading...</p>
            ) : confirmedPrescriptions.length === 0 ? (
              <p className="text-gray-400 text-center py-8">No confirmed claims yet</p>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {confirmedPrescriptions.slice(0, 5).map((prescription) => {
                  const patient = patients.find(p => p.did === prescription.credentialSubject.id);
                  const prescriptionData = prescription.credentialSubject.prescription;
                  const pharmacy = pharmacies.find(p => p.did === prescription.sharedWithPharmacy);
                  
                  return (
                    <div key={prescription.id} className="bg-gray-700 rounded-lg p-4">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <h4 className="font-medium text-white">{prescriptionData.medication.name}</h4>
                          <p className="text-sm text-gray-400">
                            Patient: {patient?.name || prescription.credentialSubject.patientInfo.name}
                          </p>
                          <p className="text-sm text-gray-400">
                            Pharmacy: {pharmacy?.name || 'Unknown'}
                          </p>
                          <p className="text-sm text-gray-400">
                            Confirmed: {prescription.confirmation ? 
                              new Date(prescription.confirmation.confirmedAt).toLocaleDateString() : 
                              'N/A'
                            }
                          </p>
                        </div>
                        <div className="text-right">
                          <span className="text-green-500 font-medium">$50</span>
                          <span className="block px-2 py-1 bg-green-500/20 text-green-500 rounded text-xs mt-1">
                            Paid
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Statistics Section */}
        {statistics && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Medication Breakdown */}
            <div className="bg-gray-800 rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4">Medication Breakdown</h2>
              <div className="space-y-3">
                {Object.entries(statistics.medicationBreakdown)
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 5)
                  .map(([medication, count]) => (
                    <div key={medication} className="flex justify-between items-center">
                      <span className="text-gray-300">{medication}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-white font-medium">{count}</span>
                        <span className="text-gray-500 text-sm">prescriptions</span>
                      </div>
                    </div>
                  ))}
              </div>
            </div>

            {/* Monthly Trend */}
            <div className="bg-gray-800 rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4">Monthly Prescriptions</h2>
              <div className="space-y-3">
                {Object.entries(statistics.monthlyBreakdown)
                  .sort((a, b) => b[0].localeCompare(a[0]))
                  .slice(0, 5)
                  .map(([month, count]) => {
                    const [year, monthNum] = month.split('-');
                    const monthName = new Date(parseInt(year), parseInt(monthNum) - 1).toLocaleString('default', { month: 'long', year: 'numeric' });
                    
                    return (
                      <div key={month} className="flex justify-between items-center">
                        <span className="text-gray-300">{monthName}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-white font-medium">{count}</span>
                          <span className="text-gray-500 text-sm">prescriptions</span>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default InsuranceDashboard;
