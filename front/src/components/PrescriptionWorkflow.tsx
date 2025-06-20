// src/components/PrescriptionWorkflow.tsx
import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { apiService } from '../services/apiService';
import type { DispensationCredential } from '../types';

const PrescriptionWorkflow: React.FC = () => {
  const { state, dispatch, getPrescriptionFlows } = useApp();
  const [activeTab, setActiveTab] = useState<'prescribe' | 'dispense' | 'confirm' | 'flows'>('flows');
  const [prescriptionForm, setPrescriptionForm] = useState({
    patientDid: '',
    medication: '',
    dosage: '',
    instructions: '',
    quantity: 1
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [qrCodes, setQrCodes] = useState<Record<string, string>>({});

  const flows = getPrescriptionFlows();
  
  const handleCreatePrescription = async () => {
    if (!state.currentActor || state.currentActor.type !== 'doctor') {
      alert('Only doctors can create prescriptions');
      return;
    }

    if (!prescriptionForm.patientDid || !prescriptionForm.medication) {
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
      // Structure data to match backend API expectations
      const requestData = {
        doctorDid: state.currentActor.did || '',
        patientDid: prescriptionForm.patientDid,
        prescriptionData: {
          patientName: patient.name,
          patientId: patient.id,
          patientAge: 30, // Mock age - could be added to patient data
          insuranceProvider: 'Demo Insurance', // Mock insurance
          diagnosis: 'General medication prescription',
          medicationName: prescriptionForm.medication,
          dosage: prescriptionForm.dosage,
          frequency: 'As prescribed', // Could be added to form
          duration: prescriptionForm.instructions || '30 days'
        }
      };

      console.log('Creating prescription with data:', requestData);
      const response = await apiService.createPrescription(requestData);
      
      if (response.success) {
        // Update local state with the created prescription
        dispatch({ type: 'ADD_PRESCRIPTION', payload: response.data.prescriptionVC });
        
        // Reset form
        setPrescriptionForm({
          patientDid: '',
          medication: '',
          dosage: '',
          instructions: '',
          quantity: 1
        });

        alert('Prescription created successfully and stored on blockchain');
      } else {
        console.error('Prescription creation failed:', response.error);
        alert(`Failed to create prescription: ${response.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Prescription creation failed:', error);
      alert(`Failed to create prescription: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDispensePrescription = async (prescriptionId: string) => {
    if (!state.currentActor || state.currentActor.type !== 'pharmacy') {
      alert('Only pharmacies can dispense prescriptions');
      return;
    }

    const prescription = state.prescriptions.find(p => p.id === prescriptionId);
    if (!prescription) {
      alert('Prescription not found');
      return;
    }

    const patient = state.actors.find(a => a.did === prescription.credentialSubject.id);
    if (!patient) {
      alert('Patient not found');
      return;
    }

    setIsProcessing(true);
    try {
      // Create dispensation VC
      const dispensationVC: DispensationCredential = {
        '@context': ['https://www.w3.org/2018/credentials/v1'],
        id: `urn:uuid:${Date.now()}-dispensation`,
        type: ['VerifiableCredential', 'DispensationCredential'],
        issuer: state.currentActor.did || '',
        issuanceDate: new Date().toISOString(),
        credentialSubject: {
          id: prescription.credentialSubject.id,
          prescription: {
            id: prescriptionId,
            medication: {
              name: prescription.credentialSubject.prescription.medication.name,
              batchNumber: `BATCH-${Date.now()}`,
              expirationDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(), // 1 year from now
              manufacturer: 'Unknown' // Default manufacturer since it's not in prescription medication
            },
            dispensedDate: new Date().toISOString(),
            pharmacyId: state.currentActor.did || '',
            pharmacistId: state.currentActor.did || '' // Using pharmacy DID as pharmacist for now
          }
        }
      };

      dispatch({ type: 'ADD_DISPENSATION', payload: dispensationVC });

      // Update prescription status
      const updatedPrescription = { 
        ...prescription, 
        credentialSubject: {
          ...prescription.credentialSubject,
          prescription: {
            ...prescription.credentialSubject.prescription,
            status: 'dispensado' as const
          }
        }
      };
      dispatch({ type: 'UPDATE_PRESCRIPTION', payload: updatedPrescription });

      // Create BSV token for dispensation
      const tokenData: any = {
        status: 'dispensado' as const,
        txid: `demo-txid-${Date.now()}`,
        vout: 0,
        satoshis: 1000,
        script: 'demo-script',
        unlockableBy: patient.did || '',
        metadata: {
          prescriptionId: prescriptionId,
          medicationInfo: prescription.credentialSubject.prescription.medication.name,
          batchNumber: `BATCH-${Date.now()}`
        }
      };

      dispatch({ type: 'ADD_TOKEN', payload: tokenData });

      alert('Prescription dispensed successfully');
    } catch (error) {
      console.error('Failed to dispense prescription:', error);
      alert('Failed to dispense prescription');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirmDispensation = async (prescriptionId: string) => {
    if (!state.currentActor || state.currentActor.type !== 'patient') {
      alert('Only patients can confirm dispensations');
      return;
    }

    const dispensation = state.dispensations.find(d => d.credentialSubject.prescription.id === prescriptionId);
    if (!dispensation) {
      alert('Dispensation not found');
      return;
    }

    setIsProcessing(true);
    try {
      // Create confirmation VC
      const confirmationVC: any = {
        '@context': ['https://www.w3.org/2018/credentials/v1'],
        id: `urn:uuid:${Date.now()}-confirmation`,
        type: ['VerifiableCredential', 'ConfirmationCredential'],
        issuer: state.currentActor.did || '',
        issuanceDate: new Date().toISOString(),
        credentialSubject: {
          id: state.currentActor.did,
          confirmation: {
            id: dispensation.id,
            status: 'confirmado' as const,
            confirmationType: 'receipt' as 'receipt' | 'insurance',
            confirmedBy: state.currentActor.did,
            confirmedAt: new Date().toISOString(),
            dispensationId: dispensation.id,
            prescriptionId: prescriptionId
          }
        }
      };

      dispatch({ type: 'ADD_CONFIRMATION', payload: confirmationVC });

      // Update token to confirmed status
      const tokenData: any = {
        status: 'confirmado' as const,
        txid: `demo-txid-${Date.now()}`,
        vout: 0,
        satoshis: 1000,
        script: 'demo-script',
        unlockableBy: state.currentActor.did || '',
        metadata: {
          prescriptionId: prescriptionId,
          medicationInfo: 'Confirmed',
          batchNumber: `BATCH-CONFIRMED-${Date.now()}`
        }
      };

      dispatch({ type: 'UPDATE_TOKEN', payload: tokenData });

      alert('Dispensation confirmed successfully');
    } catch (error) {
      console.error('Confirmation failed:', error);
      alert('Failed to confirm dispensation');
    } finally {
      setIsProcessing(false);
    }
  };

  const generateFlowQR = async (flowId: string) => {
    const flow = flows.find(f => f.id === flowId);
    if (!flow || !flow.prescriptionVC) return;

    try {
      const targetActor = state.currentActor?.type === 'patient' 
        ? state.actors.find(a => a.type === 'pharmacy')
        : state.actors.find(a => a.type === 'patient');
        
      if (!targetActor) {
        alert('Target actor not found');
        return;
      }

      const qrCode = '';
      setQrCodes(prev => ({ ...prev, [flowId]: qrCode }));
    } catch (error) {
      console.error('QR generation failed:', error);
      alert('Failed to generate QR code');
    }
  };

  const patients = state.actors.filter(a => a.type === 'patient');

  return (
    <div className="prescription-workflow">
      <div className="page-header">
        <h2>💊 Prescription Workflow</h2>
        <p>Manage the complete medical prescription lifecycle using Verifiable Credentials</p>
      </div>

      <div className="workflow-tabs">
        <button
          className={`tab-button ${activeTab === 'flows' ? 'active' : ''}`}
          onClick={() => setActiveTab('flows')}
        >
          📋 Prescription Flows
        </button>
        <button
          className={`tab-button ${activeTab === 'prescribe' ? 'active' : ''}`}
          onClick={() => setActiveTab('prescribe')}
        >
          ✍️ Create Prescription
        </button>
        <button
          className={`tab-button ${activeTab === 'dispense' ? 'active' : ''}`}
          onClick={() => setActiveTab('dispense')}
        >
          🏥 Dispense
        </button>
        <button
          className={`tab-button ${activeTab === 'confirm' ? 'active' : ''}`}
          onClick={() => setActiveTab('confirm')}
        >
          ✅ Confirm
        </button>
      </div>

      {activeTab === 'flows' && (
        <div className="prescription-flows">
          <h3>📋 Active Prescription Flows</h3>
          {flows.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">💊</div>
              <h4>No Prescription Flows</h4>
              <p>Create a prescription to begin the workflow</p>
            </div>
          ) : (
            <div className="flows-grid">
              {flows.map(flow => (
                <div key={flow.id} className="flow-card">
                  <div className="flow-header">
                    <h4>Prescription #{flow.id.slice(-6)}</h4>
                    <span className={`status-badge status-${flow.currentStage}`}>
                      {flow.currentStage.replace('_', ' ')}
                    </span>
                  </div>

                  <div className="flow-details">
                    <div className="detail-row">
                      <span className="label">Patient:</span>
                      <span className="value">
                        {state.actors.find(a => a.did === flow.prescriptionVC?.credentialSubject.id)?.name || 'Unknown'}
                      </span>
                    </div>
                    <div className="detail-row">
                      <span className="label">Doctor:</span>
                      <span className="value">
                        {state.actors.find(a => a.did === flow.prescriptionVC?.issuer)?.name || 'Unknown'}
                      </span>
                    </div>
                    {flow.pharmacyDid && (
                      <div className="detail-row">
                        <span className="label">Pharmacy:</span>
                        <span className="value">
                          {state.actors.find(a => a.did === flow.pharmacyDid)?.name || 'Unknown'}
                        </span>
                      </div>
                    )}
                    <div className="detail-row">
                      <span className="label">Medication:</span>
                      <span className="value">
                        {flow.prescriptionVC?.credentialSubject.prescription.medication.name}
                      </span>
                    </div>
                    <div className="detail-row">
                      <span className="label">Date:</span>
                      <span className="value">
                        {flow.createdAt.toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  <div className="flow-actions">
                    {flow.currentStage === 'created' && state.currentActor?.type === 'pharmacy' && (
                      <button
                        className="action-button dispense"
                        onClick={() => handleDispensePrescription(flow.id)}
                        disabled={isProcessing}
                      >
                        🏥 Dispense
                      </button>
                    )}
                    {flow.currentStage === 'dispensed' && state.currentActor?.type === 'patient' && (
                      <button
                        className="action-button confirm"
                        onClick={() => handleConfirmDispensation(flow.id)}
                        disabled={isProcessing}
                      >
                        ✅ Confirm
                      </button>
                    )}
                    <button
                      className="action-button qr"
                      onClick={() => generateFlowQR(flow.id)}
                    >
                      📱 QR Code
                    </button>
                  </div>

                  {qrCodes[flow.id] && (
                    <div className="qr-section">
                      <img 
                        src={qrCodes[flow.id]} 
                        alt={`QR code for prescription ${flow.id}`}
                        className="qr-code-image"
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'prescribe' && (
        <div className="prescribe-section">
          <h3>✍️ Create New Prescription</h3>
          
          {!state.currentActor || state.currentActor.type !== 'doctor' ? (
            <div className="access-denied">
              <div className="access-icon">🚫</div>
              <h4>Access Denied</h4>
              <p>Only doctors can create prescriptions. Please select a doctor actor.</p>
            </div>
          ) : (
            <div className="prescription-form">
              <div className="form-grid">
                <div className="form-group">
                  <label htmlFor="patient-select">Patient</label>
                  <select
                    id="patient-select"
                    value={prescriptionForm.patientDid}
                    onChange={(e) => setPrescriptionForm(prev => ({ ...prev, patientDid: e.target.value }))}
                  >
                    <option value="">Select a patient</option>
                    {patients.map(patient => (
                      <option key={patient.id} value={patient.did}>
                        {patient.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="medication">Medication</label>
                  <input
                    id="medication"
                    type="text"
                    value={prescriptionForm.medication}
                    onChange={(e) => setPrescriptionForm(prev => ({ ...prev, medication: e.target.value }))}
                    placeholder="e.g., Amoxicillin"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="dosage">Dosage</label>
                  <input
                    id="dosage"
                    type="text"
                    value={prescriptionForm.dosage}
                    onChange={(e) => setPrescriptionForm(prev => ({ ...prev, dosage: e.target.value }))}
                    placeholder="e.g., 500mg"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="quantity">Quantity</label>
                  <input
                    id="quantity"
                    type="number"
                    min="1"
                    value={prescriptionForm.quantity}
                    onChange={(e) => setPrescriptionForm(prev => ({ ...prev, quantity: parseInt(e.target.value) || 1 }))}
                  />
                </div>

                <div className="form-group full-width">
                  <label htmlFor="instructions">Instructions</label>
                  <textarea
                    id="instructions"
                    value={prescriptionForm.instructions}
                    onChange={(e) => setPrescriptionForm(prev => ({ ...prev, instructions: e.target.value }))}
                    placeholder="e.g., Take twice daily with food"
                    rows={3}
                  />
                </div>
              </div>

              <div className="form-actions">
                <button
                  className="primary-button"
                  onClick={handleCreatePrescription}
                  disabled={isProcessing || !prescriptionForm.patientDid || !prescriptionForm.medication}
                >
                  {isProcessing ? '⏳ Creating...' : '✅ Create Prescription'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'dispense' && (
        <div className="dispense-section">
          <h3>🏥 Dispense Prescriptions</h3>
          
          {!state.currentActor || state.currentActor.type !== 'pharmacy' ? (
            <div className="access-denied">
              <div className="access-icon">🚫</div>
              <h4>Access Denied</h4>
              <p>Only pharmacies can dispense prescriptions. Please select a pharmacy actor.</p>
            </div>
          ) : (
            <div className="dispense-list">
              {flows.filter(f => f.currentStage === 'created' || f.currentStage === 'sent_to_pharmacy').length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">🏥</div>
                  <h4>No Prescriptions to Dispense</h4>
                  <p>No prescriptions are available for dispensation</p>
                </div>
              ) : (
                flows
                  .filter(f => f.currentStage === 'created' || f.currentStage === 'sent_to_pharmacy')
                  .map(flow => (
                    <div key={flow.id} className="dispense-card">
                      <div className="dispense-header">
                        <h4>Prescription #{flow.id.slice(-6)}</h4>
                        <span className="urgency-badge">Normal</span>
                      </div>
                      
                      <div className="dispense-details">
                        <div className="detail-grid">
                          <div className="detail-item">
                            <span className="label">Patient:</span>
                            <span className="value">{state.actors.find(a => a.did === flow.prescriptionVC?.credentialSubject.id)?.name}</span>
                          </div>
                          <div className="detail-item">
                            <span className="label">Medication:</span>
                            <span className="value">{flow.prescriptionVC?.credentialSubject.prescription.medication.name}</span>
                          </div>
                          <div className="detail-item">
                            <span className="label">Dosage:</span>
                            <span className="value">{flow.prescriptionVC?.credentialSubject.prescription.medication.dosage}</span>
                          </div>
                          <div className="detail-item">
                            <span className="label">Quantity:</span>
                            <span className="value">{flow.prescriptionVC?.credentialSubject.prescription.medication.frequency}</span>
                          </div>
                        </div>
                        
                        <div className="instructions">
                          <span className="label">Instructions:</span>
                          <p>{flow.prescriptionVC?.credentialSubject.prescription.medication.duration}</p>
                        </div>
                      </div>

                      <div className="dispense-actions">
                        <button
                          className="primary-button"
                          onClick={() => handleDispensePrescription(flow.id)}
                          disabled={isProcessing}
                        >
                          {isProcessing ? '⏳ Dispensing...' : '🏥 Dispense Medication'}
                        </button>
                      </div>
                    </div>
                  ))
              )}
            </div>
          )}
        </div>
      )}

      {activeTab === 'confirm' && (
        <div className="confirm-section">
          <h3>✅ Confirm Dispensations</h3>
          
          {!state.currentActor || state.currentActor.type !== 'patient' ? (
            <div className="access-denied">
              <div className="access-icon">🚫</div>
              <h4>Access Denied</h4>
              <p>Only patients can confirm dispensations. Please select a patient actor.</p>
            </div>
          ) : (
            <div className="confirm-list">
              {flows.filter(f => f.currentStage === 'dispensed').length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">✅</div>
                  <h4>No Dispensations to Confirm</h4>
                  <p>No dispensations are awaiting your confirmation</p>
                </div>
              ) : (
                flows
                  .filter(f => f.currentStage === 'dispensed')
                  .map(flow => (
                    <div key={flow.id} className="confirm-card">
                      <div className="confirm-header">
                        <h4>Dispensation #{flow.id.slice(-6)}</h4>
                        <span className="status-badge">Awaiting Confirmation</span>
                      </div>
                      
                      <div className="confirm-details">
                        <div className="detail-grid">
                          <div className="detail-item">
                            <span className="label">Pharmacy:</span>
                            <span className="value">{state.actors.find(a => a.did === flow.pharmacyDid)?.name}</span>
                          </div>
                          <div className="detail-item">
                            <span className="label">Medication:</span>
                            <span className="value">{flow.prescriptionVC?.credentialSubject.prescription.medication.name}</span>
                          </div>
                          <div className="detail-item">
                            <span className="label">Dispensed:</span>
                            <span className="value">
                              {flow.dispensationVC?.credentialSubject.prescription.dispensedDate && 
                                new Date(flow.dispensationVC.credentialSubject.prescription.dispensedDate).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="confirm-actions">
                        <button
                          className="primary-button"
                          onClick={() => handleConfirmDispensation(flow.id)}
                          disabled={isProcessing}
                        >
                          {isProcessing ? '⏳ Confirming...' : '✅ Confirm Receipt'}
                        </button>
                      </div>
                    </div>
                  ))
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default PrescriptionWorkflow;
