// src/components/ActorManagement.tsx
import React, { useState, useEffect, useCallback } from 'react';
import type { ActorType, Actor } from '../types';
import { useApp } from '../context/AppContext';
import { encryptionService } from '../services/encryptionService';
import { qrService } from '../services/qrService';
import { apiService } from '../services/apiService';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

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
  const [isLoading, setIsLoading] = useState(true);

  // Load actors from backend on component mount
  const loadActors = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await apiService.getActors();
      if (response.success && response.data) {
        const actors = response.data.filter((actor: Actor) => actor.did);
        actors.forEach((actor: Actor) => {
          dispatch({ type: 'ADD_ACTOR', payload: actor });
        });
      }
    } catch (error) {
      console.error('Failed to load actors:', error);
    } finally {
      setIsLoading(false);
    }
  }, [dispatch]);

  useEffect(() => {
    loadActors();
  }, [loadActors]);

  const handleCreateActor = async () => {
    if (!newActor.name.trim()) {
      alert('Please enter actor name');
      return;
    }

    setIsCreating(true);
    try {
      // Create actor using backend API
      const actorData = {
        name: newActor.name,
        type: newActor.type,
        licenseNumber: newActor.licenseNumber || undefined,
        specialization: newActor.specialization || undefined,
      };

      const response = await apiService.createActor(actorData);
      
      if (response.success && response.data) {
        const createdActor = response.data;
        
        // Generate cryptographic keys for frontend use
        const keyPair = encryptionService.generateKeyPair();
        
        // Add keys to the actor object for frontend operations
        const actorWithKeys: Actor = {
          ...createdActor,
          publicKey: keyPair.publicKey,
          privateKey: keyPair.privateKey,
          createdAt: new Date(createdActor.createdAt)
        };

        dispatch({ type: 'ADD_ACTOR', payload: actorWithKeys });

        // Generate QR code for the actor
        const qrCode = await qrService.generateActorQR(actorWithKeys);
        setQrCodes(prev => ({ ...prev, [actorWithKeys.id]: qrCode }));

        // Reset form
        setNewActor({
          name: '',
          type: 'patient',
          licenseNumber: '',
          specialization: ''
        });
        setShowCreateForm(false);

        alert(`${actorWithKeys.type} created successfully with DID: ${actorWithKeys.did}`);
      } else {
        throw new Error(response.error || 'Failed to create actor');
      }
    } catch (error) {
      console.error('Actor creation failed:', error);
      alert(`Failed to create actor: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
        <Button 
          className="primary-button"
          onClick={() => setShowCreateForm(!showCreateForm)}
        >
          {showCreateForm ? '❌ Cancel' : '➕ Create New Actor'}
        </Button>
      </div>

      {showCreateForm && (
        <div className="create-form-container">
          <Card>
            <CardHeader>
              <CardTitle>Create New Actor</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="form-grid">
                <div className="form-group">
                  <Label htmlFor="actor-name">Name</Label>
                  <Input
                    id="actor-name"
                    type="text"
                    value={newActor.name}
                    onChange={(e) => setNewActor(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Enter actor name"
                  />
                </div>

                <div className="form-group">
                  <Label htmlFor="actor-type">Type</Label>
                  <Select value={newActor.type} onValueChange={(value) => setNewActor(prev => ({ ...prev, type: value as ActorType }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select actor type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="patient">👤 Patient</SelectItem>
                      <SelectItem value="doctor">👩‍⚕️ Doctor</SelectItem>
                      <SelectItem value="pharmacy">🏥 Pharmacy</SelectItem>
                      <SelectItem value="insurance">🛡️ Insurance</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {(newActor.type === 'doctor' || newActor.type === 'pharmacy') && (
                  <div className="form-group">
                    <Label htmlFor="license-number">License Number</Label>
                    <Input
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
                    <Label htmlFor="specialization">Specialization</Label>
                    <Input
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
                <Button
                  className="primary-button"
                  onClick={handleCreateActor}
                  disabled={isCreating || !newActor.name.trim()}
                >
                  {isCreating ? '⏳ Creating...' : '✅ Create Actor'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="actors-grid">
        {isLoading ? (
          <div className="loading-state">
            <div className="loading-icon">⏳</div>
            <h3>Loading Actors...</h3>
          </div>
        ) : state.actors.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">👥</div>
            <h3>No Actors Created</h3>
            <p>Create your first actor to begin the medical prescription demo</p>
          </div>
        ) : (
          state.actors.map(actor => (
            <Card key={actor.id}>
              <CardHeader>
                <CardTitle>{actor.name}</CardTitle>
              </CardHeader>
              <CardContent>
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
                  <Button
                    className={`select-button ${state.currentActor?.id === actor.id ? 'selected' : ''}`}
                    onClick={() => handleSelectActor(actor)}
                  >
                    {state.currentActor?.id === actor.id ? '✅ Selected' : '👆 Select'}
                  </Button>
                  <Button
                    className="qr-button"
                    onClick={() => generateQRCode(actor)}
                  >
                    📱 QR Code
                  </Button>
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
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {state.currentActor && (
        <div className="current-actor-info">
          <h3>🎯 Current Actor</h3>
          <Card>
            <CardHeader>
              <CardTitle>{state.currentActor.name}</CardTitle>
            </CardHeader>
            <CardContent>
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
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default ActorManagement;
