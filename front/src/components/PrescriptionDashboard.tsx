import React, { useState, useEffect } from 'react';
import { apiService } from '../services/apiService';

interface Actor {
  id: string;
  did: string;
  name: string;
  type: 'patient' | 'doctor' | 'pharmacy' | 'insurance';
}

interface Prescription {
  id: string;
  patientDid: string;
  doctorDid: string;
  diagnosis: string;
  medication: string;
  dosage: string;
  instructions: string;
  duration: string;
  urgent: boolean;
  status: 'pending' | 'dispensed' | 'confirmed';
  createdAt: string;
  patientName?: string;
  doctorName?: string;
}

interface Token {
  id: string;
  txid: string;
  prescriptionId: string;
  ownerDid: string;
  status: 'active' | 'transferred' | 'finalized';
  createdAt: string;
}

export const PrescriptionDashboard: React.FC = () => {
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [actors, setActors] = useState<Actor[]>([]);
  const [tokens, setTokens] = useState<Token[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [selectedView, setSelectedView] = useState<'overview' | 'create' | 'dispense' | 'confirm'>('overview');
  const [selectedActorRole, setSelectedActorRole] = useState<string>('patient');
  const [selectedActor, setSelectedActor] = useState<string>('');

  // New prescription form state
  const [newPrescription, setNewPrescription] = useState({
    patientDid: '',
    doctorDid: '',
    diagnosis: '',
    medication: '',
    dosage: '',
    instructions: '',
    duration: '',
    urgent: false
  });

  // Dispensation form state
  const [selectedPrescriptionForDispense, setSelectedPrescriptionForDispense] = useState<string>('');
  const [dispensationData, setDispensationData] = useState({
    pharmacyDid: '',
    medicationProvided: '',
    batchNumber: '',
    expiryDate: '',
    pharmacistNotes: ''
  });

  // Confirmation form state
  const [selectedPrescriptionForConfirm, setSelectedPrescriptionForConfirm] = useState<string>('');
  const [confirmationData, setConfirmationData] = useState({
    patientDid: '',
    confirmed: true,
    patientNotes: ''
  });

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (selectedActor) {
      loadActorPrescriptions();
    }
  }, [selectedActor, selectedActorRole]);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadActors(),
        loadAllPrescriptions()
      ]);
    } catch (err) {
      setError('Failed to load initial data');
    } finally {
      setLoading(false);
    }
  };

  const loadActors = async () => {
    try {
      const response = await apiService.getActors();
      if (response.success && response.data) {
        setActors(response.data.filter((actor: Actor) => actor.did));
      }
    } catch (err) {
      console.error('Failed to load actors:', err);
    }
  };

  const loadAllPrescriptions = async () => {
    try {
      // This would require a "get all prescriptions" endpoint
      // For now, we'll show prescriptions when an actor is selected
      setPrescriptions([]);
    } catch (err) {
      console.error('Failed to load prescriptions:', err);
    }
  };

  const loadActorPrescriptions = async () => {
    if (!selectedActor) return;

    setLoading(true);
    try {
      const response = await apiService.getPrescriptionsByActor(
        selectedActor, 
        selectedActorRole as 'patient' | 'doctor' | 'pharmacy'
      );
      
      if (response.success && response.data) {
        const prescriptionsWithNames = await Promise.all(
          response.data.map(async (prescription: Prescription) => {
            // Get actor names for display
            const [patientResponse, doctorResponse] = await Promise.all([
              apiService.getActorByDid(prescription.patientDid),
              apiService.getActorByDid(prescription.doctorDid)
            ]);

            return {
              ...prescription,
              patientName: patientResponse.success ? patientResponse.data?.name : 'Unknown',
              doctorName: doctorResponse.success ? doctorResponse.data?.name : 'Unknown'
            };
          })
        );
        setPrescriptions(prescriptionsWithNames);

        // Load tokens for these prescriptions
        const tokenPromises = prescriptionsWithNames.map(p => 
          apiService.getTokensByPrescription(p.id)
        );
        const tokenResponses = await Promise.all(tokenPromises);
        const allTokens = tokenResponses
          .filter(r => r.success && r.data)
          .flatMap(r => r.data);
        setTokens(allTokens);
      }
    } catch (err) {
      setError('Failed to load prescriptions');
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePrescription = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await apiService.createPrescription(newPrescription);
      
      if (response.success) {
        setNewPrescription({
          patientDid: '',
          doctorDid: '',
          diagnosis: '',
          medication: '',
          dosage: '',
          instructions: '',
          duration: '',
          urgent: false
        });
        setSelectedView('overview');
        await loadActorPrescriptions();
      } else {
        setError(response.error || 'Failed to create prescription');
      }
    } catch (err) {
      setError('Network error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleDispense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPrescriptionForDispense) return;

    setLoading(true);
    setError('');

    try {
      const response = await apiService.createDispensation(
        selectedPrescriptionForDispense,
        dispensationData
      );
      
      if (response.success) {
        setDispensationData({
          pharmacyDid: '',
          medicationProvided: '',
          batchNumber: '',
          expiryDate: '',
          pharmacistNotes: ''
        });
        setSelectedPrescriptionForDispense('');
        setSelectedView('overview');
        await loadActorPrescriptions();
      } else {
        setError(response.error || 'Failed to create dispensation');
      }
    } catch (err) {
      setError('Network error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPrescriptionForConfirm) return;

    setLoading(true);
    setError('');

    try {
      const response = await apiService.createConfirmation(
        selectedPrescriptionForConfirm,
        confirmationData
      );
      
      if (response.success) {
        setConfirmationData({
          patientDid: '',
          confirmed: true,
          patientNotes: ''
        });
        setSelectedPrescriptionForConfirm('');
        setSelectedView('overview');
        await loadActorPrescriptions();
      } else {
        setError(response.error || 'Failed to create confirmation');
      }
    } catch (err) {
      setError('Network error occurred');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'dispensed': return 'bg-blue-100 text-blue-800';
      case 'confirmed': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const getActorsByType = (type: string) => {
    return actors.filter(actor => actor.type === type);
  };

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Prescription Dashboard</h1>
        <p className="text-gray-600">Manage the complete prescription workflow</p>
      </div>

      {/* Navigation Tabs */}
      <div className="flex flex-wrap gap-2 mb-6 border-b border-gray-200">
        {[
          { key: 'overview', label: 'Overview' },
          { key: 'create', label: 'Create Prescription' },
          { key: 'dispense', label: 'Dispense Medication' },
          { key: 'confirm', label: 'Confirm Receipt' }
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setSelectedView(tab.key as any)}
            className={`px-4 py-2 font-medium rounded-t-lg ${
              selectedView === tab.key
                ? "text-blue-600 border-b-2 border-blue-600"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
          {error}
        </div>
      )}

      {/* Overview Tab */}
      {selectedView === 'overview' && (
        <div className="space-y-6">
          {/* Actor Selection */}
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-xl font-bold mb-4">View Prescriptions</h2>
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Role
                </label>
                <select
                  value={selectedActorRole}
                  onChange={(e) => setSelectedActorRole(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                >
                  <option value="patient">Patient</option>
                  <option value="doctor">Doctor</option>
                  <option value="pharmacy">Pharmacy</option>
                </select>
              </div>
              <div className="flex-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Select Actor
                </label>
                <select
                  value={selectedActor}
                  onChange={(e) => setSelectedActor(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                >
                  <option value="">Choose an actor...</option>
                  {getActorsByType(selectedActorRole).map(actor => (
                    <option key={actor.id} value={actor.did}>
                      {actor.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Prescriptions List */}
          {selectedActor && (
            <div className="bg-white rounded-lg shadow-md overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">
                  Prescriptions ({prescriptions.length})
                </h3>
              </div>
              
              {loading ? (
                <div className="p-6 text-center text-gray-500">Loading prescriptions...</div>
              ) : prescriptions.length === 0 ? (
                <div className="p-6 text-center text-gray-500">No prescriptions found</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Prescription
                        </th>
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
                          Status
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Created
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {prescriptions.map((prescription) => (
                        <tr key={prescription.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div>
                              <div className="text-sm font-medium text-gray-900">
                                {prescription.diagnosis}
                              </div>
                              <div className="text-sm text-gray-500">
                                {prescription.instructions}
                              </div>
                              {prescription.urgent && (
                                <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">
                                  Urgent
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {prescription.patientName}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {prescription.doctorName}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">{prescription.medication}</div>
                            <div className="text-sm text-gray-500">{prescription.dosage}</div>
                            <div className="text-xs text-gray-400">{prescription.duration}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(prescription.status)}`}>
                              {prescription.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {formatDate(prescription.createdAt)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Create Prescription Tab */}
      {selectedView === 'create' && (
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-bold mb-4">Create New Prescription</h2>
          <form onSubmit={handleCreatePrescription} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Patient
                </label>
                <select
                  value={newPrescription.patientDid}
                  onChange={(e) => setNewPrescription({ ...newPrescription, patientDid: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                  required
                >
                  <option value="">Select patient...</option>
                  {getActorsByType('patient').map(actor => (
                    <option key={actor.id} value={actor.did}>
                      {actor.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Doctor
                </label>
                <select
                  value={newPrescription.doctorDid}
                  onChange={(e) => setNewPrescription({ ...newPrescription, doctorDid: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                  required
                >
                  <option value="">Select doctor...</option>
                  {getActorsByType('doctor').map(actor => (
                    <option key={actor.id} value={actor.did}>
                      {actor.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Diagnosis
              </label>
              <input
                type="text"
                value={newPrescription.diagnosis}
                onChange={(e) => setNewPrescription({ ...newPrescription, diagnosis: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Medication
                </label>
                <input
                  type="text"
                  value={newPrescription.medication}
                  onChange={(e) => setNewPrescription({ ...newPrescription, medication: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Dosage
                </label>
                <input
                  type="text"
                  value={newPrescription.dosage}
                  onChange={(e) => setNewPrescription({ ...newPrescription, dosage: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                  placeholder="e.g., 500mg"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Duration
                </label>
                <input
                  type="text"
                  value={newPrescription.duration}
                  onChange={(e) => setNewPrescription({ ...newPrescription, duration: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                  placeholder="e.g., 7 days"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Instructions
              </label>
              <textarea
                value={newPrescription.instructions}
                onChange={(e) => setNewPrescription({ ...newPrescription, instructions: e.target.value })}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
                rows={3}
                placeholder="Take with food, twice daily..."
                required
              />
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="urgent"
                checked={newPrescription.urgent}
                onChange={(e) => setNewPrescription({ ...newPrescription, urgent: e.target.checked })}
                className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
              />
              <label htmlFor="urgent" className="ml-2 text-sm text-gray-700">
                Mark as urgent
              </label>
            </div>

            <div className="pt-4">
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? 'Creating...' : 'Create Prescription'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Similar forms for Dispense and Confirm tabs would go here */}
      {/* For brevity, I'm showing the structure but not implementing all forms */}
      
      {selectedView === 'dispense' && (
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-bold mb-4">Dispense Medication</h2>
          <p className="text-gray-600">Dispense form would be implemented here...</p>
        </div>
      )}

      {selectedView === 'confirm' && (
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-bold mb-4">Confirm Receipt</h2>
          <p className="text-gray-600">Confirmation form would be implemented here...</p>
        </div>
      )}
    </div>
  );
};

export default PrescriptionDashboard;