// src/components/ActorManagement.tsx
import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { encryptionService } from '../services/encryptionService';
import { qrService } from '../services/qrService';
import type { Actor, ActorType } from '../types';

const ActorManagement: React.FC = () => {
  const { state, dispatch } = useApp();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newActor, setNewActor] = useState({
    name: '',
    type: 'patient' as ActorType,
    licenseNumber: '',
    specialization: ''
  });
  const [isCreating, setIsCreating] = useState(false);
  const [qrCodes, setQrCodes] = useState<Record<string, string>>({});

  const handleCreateActor = async () => {
    if (!newActor.name.trim()) {
      alert('Please enter actor name');
      return;
    }

    setIsCreating(true);
    try {
      // Generate cryptographic keys
      const keyPair = encryptionService.generateKeyPair();
      
      // Create mock DID (in production this would involve the backend)
      const mockDid = `did:bsv:medical:${Date.now()}:0`;
      
      const actor: Actor = {
        id: Date.now().toString(),
        name: newActor.name,
        type: newActor.type,
        did: mockDid,
        publicKey: keyPair.publicKey,
        privateKey: keyPair.privateKey,
        licenseNumber: newActor.licenseNumber || undefined,
        specialization: newActor.specialization || undefined,
        createdAt: new Date()
      };

      dispatch({ type: 'ADD_ACTOR', payload: actor });

      // Generate QR code for the actor
      const qrCode = await qrService.generateActorQR(actor);
      setQrCodes(prev => ({ ...prev, [actor.id]: qrCode }));

      // Reset form
      setNewActor({
        name: '',
        type: 'patient',
        licenseNumber: '',
        specialization: ''
      });
      setShowCreateForm(false);

      alert(`${actor.type} created successfully with DID: ${actor.did}`);
    } catch (error) {
      console.error('Actor creation failed:', error);
      alert('Failed to create actor');
    } finally {
      setIsCreating(false);
    }
  };

  const handleSelectActor = (actor: Actor) => {
    dispatch({ type: 'SET_CURRENT_ACTOR', payload: actor });
  };

  const generateQRCode = async (actor: Actor) => {
    try {
      const qrCode = await qrService.generateActorQR(actor);
      setQrCodes(prev => ({ ...prev, [actor.id]: qrCode }));
    } catch (error) {
      console.error('QR generation failed:', error);
      alert('Failed to generate QR code');
    }
  };

  return (
    <div className="actor-management">
      <div className="page-header">
        <h2>👤 Actor Management</h2>
        <p>Create and manage actors (Patient, Doctor, Pharmacy) for the medical prescription demo</p>
      </div>

      <div className="action-bar">
        <button 
          className="primary-button"
          onClick={() => setShowCreateForm(!showCreateForm)}
        >
          {showCreateForm ? '❌ Cancel' : '➕ Create New Actor'}
        </button>
      </div>

      {showCreateForm && (
        <div className="create-form-container">
          <div className="form-card">
            <h3>Create New Actor</h3>
            <div className="form-grid">
              <div className="form-group">
                <label htmlFor="actor-name">Name</label>
                <input
                  id="actor-name"
                  type="text"
                  value={newActor.name}
                  onChange={(e) => setNewActor(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Enter actor name"
                />
              </div>

              <div className="form-group">
                <label htmlFor="actor-type">Type</label>
                <select
                  id="actor-type"
                  value={newActor.type}
                  onChange={(e) => setNewActor(prev => ({ ...prev, type: e.target.value as ActorType }))}
                >
                  <option value="patient">👤 Patient</option>
                  <option value="doctor">👩‍⚕️ Doctor</option>
                  <option value="pharmacy">🏥 Pharmacy</option>
                  <option value="insurance">🛡️ Insurance</option>
                </select>
              </div>

              {(newActor.type === 'doctor' || newActor.type === 'pharmacy') && (
                <div className="form-group">
                  <label htmlFor="license-number">License Number</label>
                  <input
                    id="license-number"
                    type="text"
                    value={newActor.licenseNumber}
                    onChange={(e) => setNewActor(prev => ({ ...prev, licenseNumber: e.target.value }))}
                    placeholder="Enter license number"
                  />
                </div>
              )}

              {newActor.type === 'doctor' && (
                <div className="form-group">
                  <label htmlFor="specialization">Specialization</label>
                  <input
                    id="specialization"
                    type="text"
                    value={newActor.specialization}
                    onChange={(e) => setNewActor(prev => ({ ...prev, specialization: e.target.value }))}
                    placeholder="e.g., Cardiology, General Practice"
                  />
                </div>
              )}
            </div>

            <div className="form-actions">
              <button
                className="primary-button"
                onClick={handleCreateActor}
                disabled={isCreating || !newActor.name.trim()}
              >
                {isCreating ? '⏳ Creating...' : '✅ Create Actor'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="actors-grid">
        {state.actors.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">👥</div>
            <h3>No Actors Created</h3>
            <p>Create your first actor to begin the medical prescription demo</p>
          </div>
        ) : (
          state.actors.map(actor => (
            <div
              key={actor.id}
              className={`actor-card ${state.currentActor?.id === actor.id ? 'selected' : ''}`}
            >
              <div className="actor-header">
                <div className="actor-icon">
                  {actor.type === 'patient' && '👤'}
                  {actor.type === 'doctor' && '👩‍⚕️'}
                  {actor.type === 'pharmacy' && '🏥'}
                  {actor.type === 'insurance' && '🛡️'}
                </div>
                <div className="actor-info">
                  <h4>{actor.name}</h4>
                  <span className={`actor-type actor-type-${actor.type}`}>
                    {actor.type.toUpperCase()}
                  </span>
                </div>
              </div>

              <div className="actor-details">
                <div className="detail-row">
                  <span className="label">DID:</span>
                  <span className="value did-value">{actor.did}</span>
                </div>
                {actor.licenseNumber && (
                  <div className="detail-row">
                    <span className="label">License:</span>
                    <span className="value">{actor.licenseNumber}</span>
                  </div>
                )}
                {actor.specialization && (
                  <div className="detail-row">
                    <span className="label">Specialization:</span>
                    <span className="value">{actor.specialization}</span>
                  </div>
                )}
              </div>

              <div className="actor-actions">
                <button
                  className={`select-button ${state.currentActor?.id === actor.id ? 'selected' : ''}`}
                  onClick={() => handleSelectActor(actor)}
                >
                  {state.currentActor?.id === actor.id ? '✅ Selected' : '👆 Select'}
                </button>
                <button
                  className="qr-button"
                  onClick={() => generateQRCode(actor)}
                >
                  📱 QR Code
                </button>
              </div>

              {qrCodes[actor.id] && (
                <div className="qr-code-section">
                  <h5>📱 Share DID via QR Code</h5>
                  <img 
                    src={qrCodes[actor.id]} 
                    alt={`QR code for ${actor.name}`}
                    className="qr-code-image"
                  />
                  <p className="qr-help">
                    Scan this QR code to share the actor's DID
                  </p>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {state.currentActor && (
        <div className="current-actor-info">
          <h3>🎯 Current Actor</h3>
          <div className="current-actor-card">
            <div className="current-actor-details">
              <span className="current-actor-icon">
                {state.currentActor.type === 'patient' && '👤'}
                {state.currentActor.type === 'doctor' && '👩‍⚕️'}
                {state.currentActor.type === 'pharmacy' && '🏥'}
                {state.currentActor.type === 'insurance' && '🛡️'}
              </span>
              <div>
                <h4>{state.currentActor.name}</h4>
                <p>{state.currentActor.type.toUpperCase()}</p>
                <p className="current-actor-did">{state.currentActor.did}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ActorManagement;
