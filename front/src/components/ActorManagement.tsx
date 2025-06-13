// src/components/ActorManagement.tsx
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PrivateKey, ProtoWallet } from '@bsv/sdk';
import { apiService } from '../services/apiService';
import { qrService } from '../services/qrService';
import { useApp } from '../context/AppContext';
import './ActorManagement.css';
import type { Actor, ActorType } from '../types';

export const ActorManagement = () => {
  const { state, dispatch } = useApp();
  const [qrCodes, setQrCodes] = useState<Record<string, string>>({});
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newActor, setNewActor] = useState({
    name: '',
    type: 'patient' as ActorType,
    licenseNumber: '',
    specialization: ''
  });
  const [isLoading, setIsLoading] = useState(true);

  // Load actors from backend on component mount
  const loadActors = async () => {
    setIsLoading(true);
    try {
      const response = await apiService.getActors();
      if (response.success && response.data) {
        const actors = response.data.filter((actor: Actor) => actor.did);
        // Use SET_ACTORS to replace the entire actors array
        dispatch({ type: 'SET_ACTORS', payload: actors });
      }
    } catch (error) {
      console.error('Failed to load actors:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadActors();
  }, []);

  const handleCreateActor = async () => {
    if (!newActor.name.trim()) {
      alert('Please enter actor name');
      return;
    }

    setIsLoading(true);
    try {

      // generate local Keys and create a wallet client from them.
      const privateKey = PrivateKey.fromRandom()
      const wallet = new ProtoWallet(privateKey)

      // Create actor using backend API
      const actorData = {
        name: newActor.name,
        type: newActor.type,
        licenseNumber: newActor.licenseNumber || undefined,
        specialization: newActor.specialization || undefined,
        identityKey: privateKey.toPublicKey().toString()
      };

      const response = await apiService.createActor(actorData);
      
      if (response.success && response.data) {
        const createdActor = response.data;
        
        // Add keys to the actor object for frontend operations
        const actorWithKeys: Actor = {
          ...createdActor,
          wallet,
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
      setIsLoading(false);
    }
  };

  const handleSelectActor = (actor: Actor) => {
    dispatch({ type: 'SET_CURRENT_ACTOR', payload: actor });
  };

  const handleDeleteActor = async (actor: Actor) => {
    if (!window.confirm(`Are you sure you want to delete ${actor.name} (${actor.type})?`)) {
      return;
    }

    setIsLoading(true);

    try {
      const response = await apiService.deleteActor(actor.id);
      
      if (response.success) {
        // Remove the deleted actor from the state
        dispatch({ type: 'REMOVE_ACTOR', payload: actor.id });
        // Clear current actor if it was deleted
        if (state.currentActor?.id === actor.id) {
          dispatch({ type: 'SET_CURRENT_ACTOR', payload: null });
        }
        
        // Refresh the actor list to ensure consistency
        await loadActors();
      } else {
        throw new Error(response.error || 'Failed to delete actor');
      }
    } catch (error) {
      console.error('Error deleting actor:', error);
      alert(`Failed to delete actor: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
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
                    value={newActor.name}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewActor(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Enter actor name"
                  />
                </div>

                <div className="form-group">
                  <Label htmlFor="actor-type">Type</Label>
                  <Select value={newActor.type} onValueChange={(value: string) => setNewActor(prev => ({ ...prev, type: value as ActorType }))}>
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
                      value={newActor.licenseNumber}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewActor(prev => ({ ...prev, licenseNumber: e.target.value }))}
                      placeholder="Enter license number"
                    />
                  </div>
                )}

                {newActor.type === 'doctor' && (
                  <div className="form-group">
                    <Label htmlFor="specialization">Specialization</Label>
                    <Input
                      id="specialization"
                      value={newActor.specialization}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewActor(prev => ({ ...prev, specialization: e.target.value }))}
                      placeholder="Enter specialization"
                    />
                  </div>
                )}
              </div>

              <div className="form-actions">
                <Button
                  className="primary-button"
                  onClick={handleCreateActor}
                  disabled={isLoading || !newActor.name.trim()}
                >
                  {isLoading ? '⏳ Creating...' : '✅ Create Actor'}
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
                  <Button
                    className="delete-button"
                    onClick={() => handleDeleteActor(actor)}
                  >
                    🗑️ Delete
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
