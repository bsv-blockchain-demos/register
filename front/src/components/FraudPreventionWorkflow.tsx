// src/components/FraudPreventionWorkflow.tsx
import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { apiService } from '../services/apiService';
import type { FraudPreventionPrescription, FraudAlert, SelectiveDisclosure } from '../types';

const FraudPreventionWorkflow: React.FC = () => {
  const { 
    state, 
    dispatch, 
    getCurrentFraudPreventionPrescriptions,
    getFraudAlertsByPrescription,
    getSelectiveDisclosuresByActor,
    getHighRiskPrescriptions
  } = useApp();
  
  const [activeTab, setActiveTab] = useState<'prescriptions' | 'verify' | 'dispense' | 'insurance' | 'audit' | 'alerts'>('prescriptions');
  const [prescriptionForm, setPrescriptionForm] = useState({
    patientDid: '',
    medicationName: '',
    dosage: '',
    frequency: '',
    duration: '',
    quantity: 1,
    refills: 0,
    validUntil: '',
    patientName: '',
    patientBirthDate: '',
    insuranceProvider: '',
    doctorName: '',
    licenseNumber: '',
    specialization: ''
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedPrescription, setSelectedPrescription] = useState<string | null>(null);
  const [verificationResult, setVerificationResult] = useState<any>(null);
  const [selectiveDisclosures, setSelectiveDisclosures] = useState<Record<string, any>>({});

  const fraudPrescriptions = getCurrentFraudPreventionPrescriptions();
  const highRiskPrescriptions = getHighRiskPrescriptions();
  const patients = state.actors.filter(a => a.type === 'patient');
  const doctors = state.actors.filter(a => a.type === 'doctor');

  const handleCreateFraudPreventionPrescription = async () => {
    if (!state.currentActor || state.currentActor.type !== 'doctor') {
      alert('Only doctors can create prescriptions');
      return;
    }

    if (!prescriptionForm.patientDid || !prescriptionForm.medicationName) {
      alert('Please fill in all required fields');
      return;
    }

    const patient = state.actors.find(a => a.did === prescriptionForm.patientDid);
    if (!patient) {
      alert('Patient not found');
      return;
    }

    setIsProcessing(true);
    try {
      const validUntil = prescriptionForm.validUntil || 
        new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days from now

      const params = {
        doctorDid: state.currentActor.did || '',
        patientDid: prescriptionForm.patientDid,
        prescriptionData: {
          medicationName: prescriptionForm.medicationName,
          dosage: prescriptionForm.dosage,
          frequency: prescriptionForm.frequency,
          duration: prescriptionForm.duration,
          quantity: prescriptionForm.quantity,
          refills: prescriptionForm.refills,
          validUntil: validUntil
        },
        patientInfo: {
          name: prescriptionForm.patientName || patient.name,
          birthDate: prescriptionForm.patientBirthDate,
          insuranceProvider: prescriptionForm.insuranceProvider || patient.insuranceProvider
        },
        doctorInfo: {
          name: prescriptionForm.doctorName || state.currentActor.name,
          licenseNumber: prescriptionForm.licenseNumber || state.currentActor.licenseNumber || '',
          specialization: prescriptionForm.specialization || state.currentActor.specialization
        }
      };

      const response = await apiService.createFraudPreventionPrescription(params);
      
      if (response.success) {
        const fraudPrescription: FraudPreventionPrescription = {
          id: response.data.prescriptionId,
          doctorDid: params.doctorDid,
          patientDid: params.patientDid,
          prescriptionData: params.prescriptionData,
          patientInfo: params.patientInfo,
          doctorInfo: params.doctorInfo,
          fraudScore: response.data.fraudScore,
          credentialId: response.data.credentialId,
          bbsSignature: response.data.bbsSignature,
          createdAt: new Date(),
          status: 'created'
        };

        dispatch({ type: 'ADD_FRAUD_PREVENTION_PRESCRIPTION', payload: fraudPrescription });

        // Check for fraud alerts
        if (response.data.fraudScore >= 50) {
          const alert: FraudAlert = {
            id: `alert-${Date.now()}`,
            type: 'HIGH_FRAUD_SCORE',
            prescriptionId: response.data.prescriptionId,
            fraudScore: response.data.fraudScore,
            message: `High fraud score detected: ${response.data.fraudScore}`,
            timestamp: new Date(),
            severity: response.data.fraudScore >= 80 ? 'critical' : 'high'
          };
          dispatch({ type: 'ADD_FRAUD_ALERT', payload: alert });
        }

        // Reset form
        setPrescriptionForm({
          patientDid: '',
          medicationName: '',
          dosage: '',
          frequency: '',
          duration: '',
          quantity: 1,
          refills: 0,
          validUntil: '',
          patientName: '',
          patientBirthDate: '',
          insuranceProvider: '',
          doctorName: '',
          licenseNumber: '',
          specialization: ''
        });

        alert('Fraud prevention prescription created successfully with BBS+ signature');
      } else {
        alert(`Failed to create prescription: ${response.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Prescription creation failed:', error);
      alert(`Failed to create prescription: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleVerifyPrescription = async (prescriptionId: string) => {
    if (!state.currentActor || state.currentActor.type !== 'pharmacy') {
      alert('Only pharmacies can verify prescriptions');
      return;
    }

    setIsProcessing(true);
    try {
      const prescription = fraudPrescriptions.find(p => p.id === prescriptionId);
      if (!prescription?.credentialId) {
        alert('Prescription credential not found');
        return;
      }

      const response = await apiService.verifyFraudPreventionPrescription({
        pharmacyDid: state.currentActor.did || '',
        prescriptionCredentialId: prescription.credentialId
      });

      if (response.success) {
        setVerificationResult(response.data);
        
        // Update prescription status
        const updatedPrescription = {
          ...prescription,
          status: 'verified' as const,
          fraudScore: response.data.fraudScore
        };
        dispatch({ type: 'UPDATE_FRAUD_PREVENTION_PRESCRIPTION', payload: updatedPrescription });

        // Store selective disclosure
        const disclosure: SelectiveDisclosure = {
          prescriptionId: prescriptionId,
          actorType: 'pharmacy',
          disclosedData: response.data.selectiveDisclosure,
          requestorDid: state.currentActor.did || '',
          requestTime: new Date()
        };
        dispatch({ type: 'ADD_SELECTIVE_DISCLOSURE', payload: disclosure });

        alert('Prescription verified successfully');
      } else {
        alert(`Verification failed: ${response.error}`);
      }
    } catch (error) {
      console.error('Verification failed:', error);
      alert('Verification failed');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCreateDispensingProof = async (prescriptionId: string) => {
    if (!state.currentActor || state.currentActor.type !== 'pharmacy') {
      alert('Only pharmacies can create dispensing proofs');
      return;
    }

    const prescription = fraudPrescriptions.find(p => p.id === prescriptionId);
    if (!prescription?.credentialId) {
      alert('Prescription not found');
      return;
    }

    setIsProcessing(true);
    try {
      const response = await apiService.createDispensingProof({
        pharmacyDid: state.currentActor.did || '',
        prescriptionCredentialId: prescription.credentialId,
        dispensingData: {
          batchNumber: `BATCH-${Date.now()}`,
          expirationDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
          quantityDispensed: prescription.prescriptionData.quantity,
          pharmacyName: state.currentActor.name,
          pharmacistLicense: state.currentActor.licenseNumber || 'PHARM-001'
        },
        patientConfirmation: true
      });

      if (response.success) {
        const updatedPrescription = {
          ...prescription,
          status: 'dispensed' as const,
          fraudScore: response.data.fraudScore
        };
        dispatch({ type: 'UPDATE_FRAUD_PREVENTION_PRESCRIPTION', payload: updatedPrescription });

        alert('Dispensing proof created successfully');
      } else {
        alert(`Failed to create dispensing proof: ${response.error}`);
      }
    } catch (error) {
      console.error('Dispensing proof creation failed:', error);
      alert('Failed to create dispensing proof');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRequestSelectiveDisclosure = async (prescriptionId: string, actorType: 'insurance' | 'pharmacy' | 'audit') => {
    if (!state.currentActor?.did) {
      alert('No current actor selected');
      return;
    }

    setIsProcessing(true);
    try {
      const response = await apiService.getSelectiveDisclosure({
        prescriptionId: prescriptionId,
        actorType: actorType,
        requestorDid: state.currentActor.did
      });

      if (response.success) {
        setSelectiveDisclosures(prev => ({
          ...prev,
          [prescriptionId]: response.data
        }));

        const disclosure: SelectiveDisclosure = {
          prescriptionId: prescriptionId,
          actorType: actorType,
          disclosedData: response.data,
          requestorDid: state.currentActor.did,
          requestTime: new Date()
        };
        dispatch({ type: 'ADD_SELECTIVE_DISCLOSURE', payload: disclosure });

        alert('Selective disclosure retrieved successfully');
      } else {
        alert(`Failed to get selective disclosure: ${response.error}`);
      }
    } catch (error) {
      console.error('Selective disclosure request failed:', error);
      alert('Failed to get selective disclosure');
    } finally {
      setIsProcessing(false);
    }
  };

  const renderFraudScore = (score?: number) => {
    if (score === undefined) return <span className="fraud-score unknown">Unknown</span>;
    
    const getScoreClass = (score: number) => {
      if (score >= 80) return 'critical';
      if (score >= 50) return 'high';
      if (score >= 30) return 'medium';
      return 'low';
    };

    return (
      <span className={`fraud-score ${getScoreClass(score)}`}>
        {score}
      </span>
    );
  };

  return (
    <div className="fraud-prevention-workflow">
      <div className="page-header">
        <h2>🔒 Fraud Prevention Workflow</h2>
        <p>Manage prescriptions with BBS+ selective disclosure and fraud detection</p>
      </div>

      <div className="workflow-tabs">
        <button
          className={`tab-button ${activeTab === 'prescriptions' ? 'active' : ''}`}
          onClick={() => setActiveTab('prescriptions')}
        >
          📋 Prescriptions
        </button>
        <button
          className={`tab-button ${activeTab === 'verify' ? 'active' : ''}`}
          onClick={() => setActiveTab('verify')}
        >
          🔍 Verify
        </button>
        <button
          className={`tab-button ${activeTab === 'dispense' ? 'active' : ''}`}
          onClick={() => setActiveTab('dispense')}
        >
          🏥 Dispense
        </button>
        <button
          className={`tab-button ${activeTab === 'insurance' ? 'active' : ''}`}
          onClick={() => setActiveTab('insurance')}
        >
          💰 Insurance
        </button>
        <button
          className={`tab-button ${activeTab === 'audit' ? 'active' : ''}`}
          onClick={() => setActiveTab('audit')}
        >
          🔍 Audit
        </button>
        <button
          className={`tab-button ${activeTab === 'alerts' ? 'active' : ''}`}
          onClick={() => setActiveTab('alerts')}
        >
          ⚠️ Alerts ({state.fraudAlerts.length})
        </button>
      </div>

      {activeTab === 'prescriptions' && (
        <div className="prescriptions-section">
          <h3>📋 Fraud Prevention Prescriptions</h3>
          
          {state.currentActor?.type === 'doctor' && (
            <div className="prescription-form">
              <h4>✍️ Create New Prescription</h4>
              <div className="form-grid">
                <div className="form-group">
                  <label>Patient</label>
                  <select
                    value={prescriptionForm.patientDid}
                    onChange={(e) => setPrescriptionForm(prev => ({ ...prev, patientDid: e.target.value }))}
                  >
                    <option value="">Select patient</option>
                    {patients.map(patient => (
                      <option key={patient.id} value={patient.did}>
                        {patient.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Medication</label>
                  <input
                    type="text"
                    value={prescriptionForm.medicationName}
                    onChange={(e) => setPrescriptionForm(prev => ({ ...prev, medicationName: e.target.value }))}
                    placeholder="e.g., Amoxicillin"
                  />
                </div>

                <div className="form-group">
                  <label>Dosage</label>
                  <input
                    type="text"
                    value={prescriptionForm.dosage}
                    onChange={(e) => setPrescriptionForm(prev => ({ ...prev, dosage: e.target.value }))}
                    placeholder="e.g., 500mg"
                  />
                </div>

                <div className="form-group">
                  <label>Frequency</label>
                  <input
                    type="text"
                    value={prescriptionForm.frequency}
                    onChange={(e) => setPrescriptionForm(prev => ({ ...prev, frequency: e.target.value }))}
                    placeholder="e.g., Twice daily"
                  />
                </div>

                <div className="form-group">
                  <label>Duration</label>
                  <input
                    type="text"
                    value={prescriptionForm.duration}
                    onChange={(e) => setPrescriptionForm(prev => ({ ...prev, duration: e.target.value }))}
                    placeholder="e.g., 10 days"
                  />
                </div>

                <div className="form-group">
                  <label>Quantity</label>
                  <input
                    type="number"
                    min="1"
                    value={prescriptionForm.quantity}
                    onChange={(e) => setPrescriptionForm(prev => ({ ...prev, quantity: parseInt(e.target.value) || 1 }))}
                  />
                </div>

                <div className="form-group">
                  <label>Refills</label>
                  <input
                    type="number"
                    min="0"
                    value={prescriptionForm.refills}
                    onChange={(e) => setPrescriptionForm(prev => ({ ...prev, refills: parseInt(e.target.value) || 0 }))}
                  />
                </div>

                <div className="form-group">
                  <label>Valid Until</label>
                  <input
                    type="date"
                    value={prescriptionForm.validUntil}
                    onChange={(e) => setPrescriptionForm(prev => ({ ...prev, validUntil: e.target.value }))}
                  />
                </div>
              </div>

              <button
                className="primary-button"
                onClick={handleCreateFraudPreventionPrescription}
                disabled={isProcessing || !prescriptionForm.patientDid || !prescriptionForm.medicationName}
              >
                {isProcessing ? '⏳ Creating...' : '✅ Create Prescription'}
              </button>
            </div>
          )}

          <div className="prescriptions-list">
            {fraudPrescriptions.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">🔒</div>
                <h4>No Fraud Prevention Prescriptions</h4>
                <p>Create a prescription to begin the fraud prevention workflow</p>
              </div>
            ) : (
              <div className="prescriptions-grid">
                {fraudPrescriptions.map(prescription => (
                  <div key={prescription.id} className="prescription-card">
                    <div className="prescription-header">
                      <h4>Prescription #{prescription.id.slice(-6)}</h4>
                      <span className={`status-badge status-${prescription.status}`}>
                        {prescription.status}
                      </span>
                    </div>

                    <div className="prescription-details">
                      <div className="detail-row">
                        <span className="label">Patient:</span>
                        <span className="value">{prescription.patientInfo.name}</span>
                      </div>
                      <div className="detail-row">
                        <span className="label">Medication:</span>
                        <span className="value">{prescription.prescriptionData.medicationName}</span>
                      </div>
                      <div className="detail-row">
                        <span className="label">Dosage:</span>
                        <span className="value">{prescription.prescriptionData.dosage}</span>
                      </div>
                      <div className="detail-row">
                        <span className="label">Fraud Score:</span>
                        {renderFraudScore(prescription.fraudScore)}
                      </div>
                      <div className="detail-row">
                        <span className="label">Date:</span>
                        <span className="value">{prescription.createdAt.toLocaleDateString()}</span>
                      </div>
                    </div>

                    <div className="prescription-actions">
                      {prescription.status === 'created' && state.currentActor?.type === 'pharmacy' && (
                        <button
                          className="action-button verify"
                          onClick={() => handleVerifyPrescription(prescription.id)}
                          disabled={isProcessing}
                        >
                          🔍 Verify
                        </button>
                      )}
                      {prescription.status === 'verified' && state.currentActor?.type === 'pharmacy' && (
                        <button
                          className="action-button dispense"
                          onClick={() => handleCreateDispensingProof(prescription.id)}
                          disabled={isProcessing}
                        >
                          🏥 Dispense
                        </button>
                      )}
                      {(state.currentActor?.type === 'insurance' || state.currentActor?.type === 'auditor') && (
                        <button
                          className="action-button disclosure"
                          onClick={() => handleRequestSelectiveDisclosure(prescription.id, state.currentActor?.type === 'auditor' ? 'audit' : 'insurance')}
                          disabled={isProcessing}
                        >
                          📊 Get Disclosure
                        </button>
                      )}
                    </div>

                    {selectiveDisclosures[prescription.id] && (
                      <div className="selective-disclosure">
                        <h5>Selective Disclosure</h5>
                        <pre>{JSON.stringify(selectiveDisclosures[prescription.id], null, 2)}</pre>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'alerts' && (
        <div className="alerts-section">
          <h3>⚠️ Fraud Alerts</h3>
          {state.fraudAlerts.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">✅</div>
              <h4>No Fraud Alerts</h4>
              <p>No fraud alerts have been detected</p>
            </div>
          ) : (
            <div className="alerts-list">
              {state.fraudAlerts.map(alert => (
                <div key={alert.id} className={`alert-card severity-${alert.severity}`}>
                  <div className="alert-header">
                    <h4>{alert.type.replace('_', ' ')}</h4>
                    <span className={`severity-badge ${alert.severity}`}>
                      {alert.severity.toUpperCase()}
                    </span>
                  </div>
                  <div className="alert-details">
                    <p>{alert.message}</p>
                    <div className="alert-meta">
                      <span>Prescription: {alert.prescriptionId.slice(-6)}</span>
                      <span>Score: {alert.fraudScore}</span>
                      <span>Time: {alert.timestamp.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          {state.fraudAlerts.length > 0 && (
            <button
              className="secondary-button"
              onClick={() => dispatch({ type: 'CLEAR_FRAUD_ALERTS' })}
            >
              Clear All Alerts
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default FraudPreventionWorkflow;