import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { apiService } from '../services/apiService';
import type { Actor } from '../types';

interface PrescriptionFormData {
  patientDid: string;
  patientName: string;
  patientAge: number;
  diagnosis: string;
  medicationName: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions: string;
  insuranceProvider?: string;
}

export const PrescriptionForm: React.FC = () => {
  const { currentUser } = useAuth();
  const [patients, setPatients] = useState<Actor[]>([]);
  const [formData, setFormData] = useState<PrescriptionFormData>({
    patientDid: '',
    patientName: '',
    patientAge: 0,
    diagnosis: '',
    medicationName: '',
    dosage: '',
    frequency: '',
    duration: '',
    instructions: '',
    insuranceProvider: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    loadPatients();
  }, []);

  const loadPatients = async () => {
    try {
      const response = await apiService.getActors();
      if (response.success && response.data) {
        // Filter for patients who have DIDs
        const patientActors = response.data.filter((actor: Actor) => 
          actor.type === 'patient' && actor.did
        );
        setPatients(patientActors);
      }
    } catch (error) {
      console.error('Failed to load patients:', error);
    }
  };

  const handlePatientSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedPatient = patients.find(p => p.did === e.target.value);
    if (selectedPatient) {
      setFormData(prev => ({
        ...prev,
        patientDid: selectedPatient.did || '',
        patientName: selectedPatient.name,
        insuranceProvider: selectedPatient.insuranceProvider || ''
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser?.did) {
      setError('Doctor DID not found. Please ensure you are logged in with a valid doctor account.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const prescriptionData = {
        doctorDid: currentUser.did,
        patientDid: formData.patientDid,
        prescriptionData: {
          patientName: formData.patientName,
          patientId: formData.patientDid,
          patientAge: formData.patientAge,
          insuranceProvider: formData.insuranceProvider,
          diagnosis: formData.diagnosis,
          medicationName: formData.medicationName,
          dosage: formData.dosage,
          frequency: formData.frequency,
          duration: formData.duration,
          instructions: formData.instructions
        }
      };

      const response = await apiService.createPrescription(prescriptionData);
      
      if (response.success) {
        setSuccess('Prescription created successfully!');
        // Reset form
        setFormData({
          patientDid: '',
          patientName: '',
          patientAge: 0,
          diagnosis: '',
          medicationName: '',
          dosage: '',
          frequency: '',
          duration: '',
          instructions: '',
          insuranceProvider: ''
        });
      } else {
        setError(response.error || 'Failed to create prescription');
      }
    } catch (error) {
      setError('Failed to create prescription. Please try again.');
      console.error('Error creating prescription:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-gray-800 rounded-lg p-6">
      <h2 className="text-2xl font-bold mb-6">Create Prescription</h2>
      
      {error && (
        <div className="bg-red-500/10 border border-red-500 text-red-500 p-4 rounded-lg mb-4">
          {error}
        </div>
      )}
      
      {success && (
        <div className="bg-green-500/10 border border-green-500 text-green-500 p-4 rounded-lg mb-4">
          {success}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">Patient</label>
          <select
            value={formData.patientDid}
            onChange={handlePatientSelect}
            className="w-full px-4 py-2 bg-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500"
            required
          >
            <option value="">Select a patient</option>
            {patients.map(patient => (
              <option key={patient.id} value={patient.did}>
                {patient.name} - {patient.did?.substring(0, 20)}...
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">Patient Age</label>
            <input
              type="number"
              value={formData.patientAge}
              onChange={(e) => setFormData(prev => ({ ...prev, patientAge: parseInt(e.target.value) }))}
              className="w-full px-4 py-2 bg-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500"
              required
              min="1"
              max="150"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-2">Insurance Provider</label>
            <input
              type="text"
              value={formData.insuranceProvider}
              onChange={(e) => setFormData(prev => ({ ...prev, insuranceProvider: e.target.value }))}
              className="w-full px-4 py-2 bg-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="Optional"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Diagnosis</label>
          <textarea
            value={formData.diagnosis}
            onChange={(e) => setFormData(prev => ({ ...prev, diagnosis: e.target.value }))}
            className="w-full px-4 py-2 bg-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500"
            rows={3}
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Medication Name</label>
          <input
            type="text"
            value={formData.medicationName}
            onChange={(e) => setFormData(prev => ({ ...prev, medicationName: e.target.value }))}
            className="w-full px-4 py-2 bg-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">Dosage</label>
            <input
              type="text"
              value={formData.dosage}
              onChange={(e) => setFormData(prev => ({ ...prev, dosage: e.target.value }))}
              className="w-full px-4 py-2 bg-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., 500mg"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-2">Frequency</label>
            <input
              type="text"
              value={formData.frequency}
              onChange={(e) => setFormData(prev => ({ ...prev, frequency: e.target.value }))}
              className="w-full px-4 py-2 bg-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., Twice daily"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-2">Duration</label>
            <input
              type="text"
              value={formData.duration}
              onChange={(e) => setFormData(prev => ({ ...prev, duration: e.target.value }))}
              className="w-full px-4 py-2 bg-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., 7 days"
              required
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Instructions</label>
          <textarea
            value={formData.instructions}
            onChange={(e) => setFormData(prev => ({ ...prev, instructions: e.target.value }))}
            className="w-full px-4 py-2 bg-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500"
            rows={3}
            placeholder="Special instructions for the patient"
            required
          />
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className={`w-full py-3 rounded-lg font-medium transition-colors ${
            isSubmitting
              ? 'bg-gray-600 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700'
          }`}
        >
          {isSubmitting ? 'Creating Prescription...' : 'Create Prescription'}
        </button>
      </form>
    </div>
  );
};
