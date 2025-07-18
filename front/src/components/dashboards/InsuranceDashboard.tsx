import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useApp } from '../../context/AppContext';
import { Link } from 'react-router-dom';
import { apiService } from '../../services/apiService';
import type { PrescriptionCredential, Actor } from '../../types';
import { FiFileText, FiClock, FiCheckCircle, FiAlertCircle, FiTrendingUp, FiShield, FiEye, FiAlertTriangle } from 'react-icons/fi';

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
  status: 'active' | 'dispensed' | 'confirmed' | 'created' | 'dispensing';
  dispensation?: Dispensation;
  confirmation?: Confirmation;
  sharedWithPharmacy?: string;
  sharedAt?: string;
  // Enhanced prescription token fields
  txid?: string;
  patientDid?: string;
  doctorDid?: string;
  pharmacyDid?: string;
  insuranceDid?: string;
  dispensationVC?: any;
  confirmationVC?: any;
  prescriptionVC?: any;
  tokenState?: {
    owner: string;
    canDispense: boolean;
    dispensedAt: Date | null;
    confirmedAt: Date | null;
  };
  fraudPrevention?: {
    fraudScore: number;
    fraudRisk: 'low' | 'medium' | 'high';
    fraudAlerts: string[];
    insuranceNotified: boolean;
    selectiveDisclosureEnabled: boolean;
    bbsPlusSignatureUsed: boolean;
  };
}

interface InsuranceStats {
  totalPrescriptions: number;
  dispensed: number;
  confirmed: number;
  pending: number;
  medicationBreakdown: Record<string, number>;
  monthlyBreakdown: Record<string, number>;
}

interface FraudVerificationResult {
  claimApproved: boolean;
  fraudScore: number;
  fraudRisk: 'low' | 'medium' | 'high';
  verification: {
    prescriptionExists: boolean;
    medicationDispensed: boolean;
    doctorAuthorized: boolean;
    pharmacyAuthorized: boolean;
    patientConfirmed: boolean;
  };
  proofHash: string;
  verificationTimestamp: string;
}

interface FraudPreventionStats {
  totalClaims: number;
  claimsVerified: number;
  fraudDetected: number;
  averageFraudScore: number;
  highRiskClaims: number;
}

const InsuranceDashboard: React.FC = () => {
  const { currentUser } = useAuth();
  const { state } = useApp();
  const [prescriptions, setPrescriptions] = useState<EnhancedPrescription[]>([]);
  const [statistics, setStatistics] = useState<InsuranceStats | null>(null);
  const [fraudStats, setFraudStats] = useState<FraudPreventionStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [verifyingClaims, setVerifyingClaims] = useState<Set<string>>(new Set());
  const [verificationResults, setVerificationResults] = useState<Map<string, FraudVerificationResult>>(new Map());
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
        
        let foundEnhancedPrescriptions = false;
        
        // First try to fetch enhanced prescriptions using DID
        if (currentUser.did) {
          try {
            const enhancedResponse = await fetch(
              `http://localhost:3000/v1/enhanced/prescriptions/insurance/${encodeURIComponent(currentUser.did)}`,
              {
                headers: {
                  'Accept': 'application/json',
                  'Content-Type': 'application/json'
                }
              }
            );
            
            if (enhancedResponse.ok) {
              const enhancedData = await enhancedResponse.json();
              if (enhancedData.success && enhancedData.data && enhancedData.data.length > 0) {
                console.log('[InsuranceDashboard] Found enhanced prescriptions:', enhancedData.data);
                setPrescriptions(enhancedData.data);
                foundEnhancedPrescriptions = true;
              }
            }
          } catch (error) {
            console.error('[InsuranceDashboard] Error fetching enhanced prescriptions:', error);
          }
        }
        
        // Fallback to regular prescriptions if no enhanced prescriptions found
        if (!foundEnhancedPrescriptions) {
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
        
        // Fetch fraud prevention statistics
        try {
          const fraudStatsResponse = await apiService.getFraudPreventionStats();
          if (fraudStatsResponse.success && fraudStatsResponse.data) {
            setFraudStats({
              totalClaims: fraudStatsResponse.data.totalVerifications || 0,
              claimsVerified: fraudStatsResponse.data.totalApproved || 0,
              fraudDetected: fraudStatsResponse.data.totalRejected || 0,
              averageFraudScore: fraudStatsResponse.data.averageFraudScore || 0,
              highRiskClaims: fraudStatsResponse.data.highRiskClaims || 0
            });
          }
        } catch (error) {
          console.error('Failed to load fraud prevention stats:', error);
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

  const activePrescriptions = prescriptions.filter(p => p.status === 'active' || p.status === 'created');
  const dispensedPrescriptions = prescriptions.filter(p => p.status === 'dispensed' || p.status === 'dispensing');
  const confirmedPrescriptions = prescriptions.filter(p => p.status === 'confirmed');

  const totalClaimAmount = confirmedPrescriptions.length * 50; // $50 per confirmed prescription

  // Fraud prevention functions
  const verifyClaim = async (prescription: EnhancedPrescription) => {
    if (!currentUser?.did) return;
    
    try {
      setVerifyingClaims(prev => new Set(prev).add(prescription.id));
      
      const response = await apiService.verifyInsuranceClaim({
        insurerDid: currentUser.did,
        prescriptionCredentialId: prescription.id,
        dispensingCredentialId: prescription.dispensation?.id || '',
        claimAmount: 50
      });
      
      if (response.success && response.data) {
        setVerificationResults(prev => {
          const newResults = new Map(prev);
          newResults.set(prescription.id, response.data);
          return newResults;
        });
      }
    } catch (error) {
      console.error('Failed to verify claim:', error);
    } finally {
      setVerifyingClaims(prev => {
        const newSet = new Set(prev);
        newSet.delete(prescription.id);
        return newSet;
      });
    }
  };

  const getRiskColor = (fraudScore: number) => {
    if (fraudScore < 25) return 'text-green-500';
    if (fraudScore < 50) return 'text-yellow-500';
    return 'text-red-500';
  };

  const getRiskBadge = (fraudScore: number) => {
    if (fraudScore < 25) return 'bg-green-500/20 text-green-500';
    if (fraudScore < 50) return 'bg-yellow-500/20 text-yellow-500';
    return 'bg-red-500/20 text-red-500';
  };

  const getRiskText = (fraudScore: number) => {
    if (fraudScore < 25) return 'Low Risk';
    if (fraudScore < 50) return 'Medium Risk';
    return 'High Risk';
  };

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

        {/* Fraud Prevention Alert */}
        {fraudStats && fraudStats.highRiskClaims > 0 && (
          <div className="bg-red-900/50 border border-red-500 rounded-lg p-4 mb-6">
            <div className="flex items-center gap-2">
              <FiAlertTriangle className="text-red-500 text-xl" />
              <h3 className="text-red-500 font-semibold">High Risk Claims Alert</h3>
            </div>
            <p className="text-red-300 mt-2">
              {fraudStats.highRiskClaims} claims require immediate attention due to high fraud risk scores.
            </p>
          </div>
        )}

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-6 gap-6 mb-8">
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
              <h3 className="text-gray-400">Claims Verified</h3>
              <FiShield className="text-blue-500 text-2xl" />
            </div>
            <p className="text-3xl font-bold text-white">{fraudStats?.claimsVerified || 0}</p>
            <p className="text-sm text-gray-500 mt-2">Fraud prevention</p>
          </div>
          
          <div className="bg-gray-800 rounded-lg p-6">
            <div className="flex justify-between items-start">
              <h3 className="text-gray-400">Dispensed</h3>
              <FiAlertCircle className="text-orange-500 text-2xl" />
            </div>
            <p className="text-3xl font-bold text-white">{dispensedPrescriptions.length}</p>
            <p className="text-sm text-gray-500 mt-2">Awaiting verification</p>
          </div>
          
          <div className="bg-gray-800 rounded-lg p-6">
            <div className="flex justify-between items-start">
              <h3 className="text-gray-400">Fraud Detected</h3>
              <FiAlertTriangle className="text-red-500 text-2xl" />
            </div>
            <p className="text-3xl font-bold text-white">{fraudStats?.fraudDetected || 0}</p>
            <p className="text-sm text-gray-500 mt-2">Prevented claims</p>
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
                  // Handle both regular and enhanced prescription formats
                  const isEnhanced = prescription.prescriptionVC || prescription.patientDid;
                  
                  let patient, doctor, prescriptionData, prescribedDate;
                  
                  if (isEnhanced) {
                    // Enhanced prescription format
                    patient = patients.find(p => p.did === prescription.patientDid);
                    doctor = doctors.find(d => d.did === prescription.doctorDid);
                    const credentialSubject = prescription.prescriptionVC?.credentialSubject || {};
                    prescriptionData = credentialSubject.prescription || {};
                    prescribedDate = prescription.createdAt || prescription.prescriptionVC?.issuanceDate;
                  } else {
                    // Regular prescription format
                    patient = patients.find(p => p.did === prescription.credentialSubject?.id);
                    doctor = doctors.find(d => d.did === prescription.issuer);
                    prescriptionData = prescription.credentialSubject?.prescription || {};
                    prescribedDate = prescription.issuanceDate;
                  }
                  
                  const medicationName = prescriptionData.medicationName || prescriptionData.medication?.name || 'Unknown Medication';
                  const patientName = patient?.name || prescription.credentialSubject?.patientInfo?.name || 'Unknown Patient';
                  const doctorName = doctor?.name || 'Unknown Doctor';
                  
                  return (
                    <div key={prescription.id} className="bg-gray-700 rounded-lg p-4">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <h4 className="font-medium text-white">{medicationName}</h4>
                          <p className="text-sm text-gray-400">
                            Patient: {patientName}
                          </p>
                          <p className="text-sm text-gray-400">
                            Doctor: {doctorName}
                          </p>
                          <p className="text-sm text-gray-400">
                            Prescribed: {prescribedDate ? new Date(prescribedDate).toLocaleDateString() : 'Unknown'}
                          </p>
                          {isEnhanced && prescription.fraudPrevention && (
                            <div className="mt-2">
                              <span className={`text-xs px-2 py-1 rounded ${getRiskBadge(prescription.fraudPrevention.fraudScore)}`}>
                                {getRiskText(prescription.fraudPrevention.fraudScore)} ({prescription.fraudPrevention.fraudScore})
                              </span>
                            </div>
                          )}
                        </div>
                        <span className="px-2 py-1 bg-yellow-500/20 text-yellow-500 rounded text-xs">
                          {isEnhanced ? 'Enhanced' : 'Active'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Claims Verification */}
          <div className="bg-gray-800 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center">
              <FiShield className="mr-2 text-blue-500" />
              Claims Verification
            </h2>
            {loading ? (
              <p className="text-gray-400">Loading...</p>
            ) : dispensedPrescriptions.length === 0 ? (
              <p className="text-gray-400 text-center py-8">No claims requiring verification</p>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {dispensedPrescriptions.slice(0, 5).map((prescription) => {
                  // Handle both regular and enhanced prescription formats
                  const isEnhanced = prescription.prescriptionVC || prescription.patientDid;
                  
                  let patient, prescriptionData, pharmacy, dispensedDate;
                  
                  if (isEnhanced) {
                    // Enhanced prescription format
                    patient = patients.find(p => p.did === prescription.patientDid);
                    const credentialSubject = prescription.prescriptionVC?.credentialSubject || {};
                    prescriptionData = credentialSubject.prescription || {};
                    pharmacy = pharmacies.find(p => p.did === prescription.pharmacyDid);
                    dispensedDate = prescription.tokenState?.dispensedAt || prescription.dispensationVC?.issuanceDate;
                  } else {
                    // Regular prescription format
                    patient = patients.find(p => p.did === prescription.credentialSubject?.id);
                    prescriptionData = prescription.credentialSubject?.prescription || {};
                    pharmacy = pharmacies.find(p => p.did === prescription.sharedWithPharmacy);
                    dispensedDate = prescription.dispensation?.dispensedAt;
                  }
                  
                  const medicationName = prescriptionData.medicationName || prescriptionData.medication?.name || 'Unknown Medication';
                  const patientName = patient?.name || prescription.credentialSubject?.patientInfo?.name || 'Unknown Patient';
                  const pharmacyName = pharmacy?.name || 'Unknown Pharmacy';
                  
                  const isVerifying = verifyingClaims.has(prescription.id);
                  const verificationResult = verificationResults.get(prescription.id);
                  
                  // Show fraud prevention data if available
                  const fraudScore = prescription.fraudPrevention?.fraudScore || verificationResult?.fraudScore || 0;
                  const showFraudInfo = prescription.fraudPrevention || verificationResult;
                  
                  return (
                    <div key={prescription.id} className="bg-gray-700 rounded-lg p-4">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <h4 className="font-medium text-white">{medicationName}</h4>
                          <p className="text-sm text-gray-400">
                            Patient: {patientName}
                          </p>
                          <p className="text-sm text-gray-400">
                            Pharmacy: {pharmacyName}
                          </p>
                          <p className="text-sm text-gray-400">
                            Dispensed: {dispensedDate ? 
                              new Date(dispensedDate).toLocaleDateString() : 
                              'N/A'
                            }
                          </p>
                          {showFraudInfo && (
                            <div className="mt-2">
                              <p className={`text-sm font-medium ${getRiskColor(fraudScore)}`}>
                                Fraud Score: {fraudScore}
                              </p>
                              <p className={`text-xs px-2 py-1 rounded mt-1 inline-block ${getRiskBadge(fraudScore)}`}>
                                {getRiskText(fraudScore)}
                              </p>
                              {isEnhanced && prescription.fraudPrevention?.bbsPlusSignatureUsed && (
                                <p className="text-xs text-blue-400 mt-1">
                                  🔒 BBS+ Signature Verified
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="text-right">
                          {verificationResult ? (
                            <div>
                              <span className={`text-sm font-medium ${
                                verificationResult.claimApproved ? 'text-green-500' : 'text-red-500'
                              }`}>
                                {verificationResult.claimApproved ? 'Approved' : 'Denied'}
                              </span>
                              <span className="block text-gray-400 text-xs mt-1">$50</span>
                            </div>
                          ) : (
                            <button
                              onClick={() => verifyClaim(prescription)}
                              disabled={isVerifying}
                              className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 px-3 py-1 rounded text-sm transition-colors"
                            >
                              {isVerifying ? 'Verifying...' : 'Verify Claim'}
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
        </div>

        {/* Statistics Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Medication Breakdown */}
          {statistics && (
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
          )}

          {/* Monthly Trend */}
          {statistics && (
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
          )}
          
          {/* Fraud Prevention Stats */}
          <div className="bg-gray-800 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center">
              <FiShield className="mr-2 text-blue-500" />
              Fraud Prevention
            </h2>
            {fraudStats ? (
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-300">Total Claims</span>
                  <span className="text-white font-medium">{fraudStats.totalClaims}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-300">Verified</span>
                  <span className="text-green-500 font-medium">{fraudStats.claimsVerified}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-300">Fraud Detected</span>
                  <span className="text-red-500 font-medium">{fraudStats.fraudDetected}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-300">Avg. Fraud Score</span>
                  <span className={`font-medium ${getRiskColor(fraudStats.averageFraudScore)}`}>
                    {fraudStats.averageFraudScore.toFixed(1)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-300">Prevention Rate</span>
                  <span className="text-blue-500 font-medium">
                    {fraudStats.totalClaims > 0 ? 
                      ((fraudStats.fraudDetected / fraudStats.totalClaims) * 100).toFixed(1) : 
                      0
                    }%
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-gray-400">No fraud prevention data available</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default InsuranceDashboard;
