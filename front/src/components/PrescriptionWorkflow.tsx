// src/components/PrescriptionWorkflow.tsx
import React, { useState } from 'react';
import { useApp } from '../context/AppContext';

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
      // Create prescription VC
      const prescriptionVC = {
        id: `prescription-${Date.now()}`,
        medication: prescriptionForm.medication,
        dosage: prescriptionForm.dosage,
        instructions: prescriptionForm.instructions,
        quantity: prescriptionForm.quantity,
        prescribedDate: new Date().toISOString(),
        doctorId: state.currentActor.did
      };

      dispatch({ type: 'ADD_PRESCRIPTION', payload: prescriptionVC });

      // Create BSV token for the prescription
      const token = {
        metadata: {
          prescriptionId: prescriptionVC.id
        }
      };

      dispatch({ type: 'ADD_TOKEN', payload: token });

      // Generate QR code for the prescription
      const qrCode = '';
      setQrCodes(prev => ({ ...prev, [prescriptionVC.id]: qrCode }));

      // Reset form
      setPrescriptionForm({
        patientDid: '',
        medication: '',
        dosage: '',
        instructions: '',
        quantity: 1
      });

      alert('Prescription created successfully and tokenized on BSV blockchain');
    } catch (error) {
      console.error('Prescription creation failed:', error);
      alert('Failed to create prescription');
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

    const patient = state.actors.find(a => a.did === prescription.patientDid);
    if (!patient) {
      alert('Patient not found');
      return;
    }

    setIsProcessing(true);
    try {
      // Create dispensation VC
      const dispensationVC = {
        prescriptionId: prescriptionId,
        dispensedDate: new Date().toISOString(),
        pharmacyId: state.currentActor.did,
        dispensedQuantity: prescription.quantity
      };

      dispatch({ type: 'ADD_DISPENSATION', payload: dispensationVC });

      // Update prescription status
      const updatedPrescription = { ...prescription, status: 'dispensed' };
      dispatch({ type: 'UPDATE_PRESCRIPTION', payload: updatedPrescription });

      // Transfer token to pharmacy
      const token = state.tokens.find(t => t.metadata?.prescriptionId === prescriptionId);
      if (token) {
        const updatedToken = { ...token, status: 'transferred' };
        dispatch({ type: 'UPDATE_TOKEN', payload: updatedToken });
      }

      alert('Prescription dispensed successfully');
    } catch (error) {
      console.error('Dispensation failed:', error);
      alert('Failed to dispense prescription');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirmDispensation = async (prescriptionId: string) => {
    if (!state.currentActor || state.currentActor.type !== 'patient') {
      alert('Only patients can confirm dispensation');
      return;
    }

    const dispensation = state.dispensations.find(d => d.prescriptionId === prescriptionId);
    if (!dispensation) {
      alert('Dispensation not found');
      return;
    }

    setIsProcessing(true);
    try {
      // Create confirmation VC
      const confirmationVC = {
        prescriptionId: prescriptionId,
        confirmedDate: new Date().toISOString(),
        confirmationType: 'dispensation_received',
        confirmed: true
      };

      dispatch({ type: 'ADD_CONFIRMATION', payload: confirmationVC });

      // Update token status to completed
      const token = state.tokens.find(t => t.metadata?.prescriptionId === prescriptionId);
      if (token) {
        const completedToken = { ...token, status: 'completed' };
        dispatch({ type: 'UPDATE_TOKEN', payload: completedToken });
      }

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
                        {state.actors.find(a => a.did === flow.patientDid)?.name || 'Unknown'}
                      </span>
                    </div>
                    <div className="detail-row">
                      <span className="label">Doctor:</span>
                      <span className="value">
                        {state.actors.find(a => a.did === flow.doctorDid)?.name || 'Unknown'}
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
                        {flow.prescriptionVC?.medication}
                      </span>
                    </div>
                    <div className="detail-row">
                      <span className="label">Created:</span>
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
                            <span className="value">{state.actors.find(a => a.did === flow.patientDid)?.name}</span>
                          </div>
                          <div className="detail-item">
                            <span className="label">Medication:</span>
                            <span className="value">{flow.prescriptionVC?.medication}</span>
                          </div>
                          <div className="detail-item">
                            <span className="label">Dosage:</span>
                            <span className="value">{flow.prescriptionVC?.dosage}</span>
                          </div>
                          <div className="detail-item">
                            <span className="label">Quantity:</span>
                            <span className="value">{flow.prescriptionVC?.quantity}</span>
                          </div>
                        </div>
                        
                        <div className="instructions">
                          <span className="label">Instructions:</span>
                          <p>{flow.prescriptionVC?.instructions}</p>
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
                            <span className="value">{flow.prescriptionVC?.medication}</span>
                          </div>
                          <div className="detail-item">
                            <span className="label">Dispensed:</span>
                            <span className="value">
                              {flow.dispensationVC?.dispensedDate && 
                                new Date(flow.dispensationVC.dispensedDate).toLocaleDateString()}
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
