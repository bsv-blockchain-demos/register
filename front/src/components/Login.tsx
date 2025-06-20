import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiService } from '../services/apiService';
import type { Actor } from '../types';

const Login: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [actors, setActors] = useState<Actor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadActors();
  }, []);

  const loadActors = async () => {
    try {
      setIsLoading(true);
      const response = await apiService.getActors();
      if (response.success && response.data) {
        setActors(response.data);
      } else {
        setActors([]);
      }
      setError(null);
    } catch (err) {
      console.error('Failed to load actors:', err);
      setError('Failed to load actors. Please try again.');
      setActors([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleActorSelection = (actor: Actor) => {
    // Login with the selected actor
    login(actor);
    navigate('/dashboard');
  };

  const groupedActors = actors.reduce((acc, actor) => {
    if (!acc[actor.type]) {
      acc[actor.type] = [];
    }
    acc[actor.type].push(actor);
    return acc;
  }, {} as Record<string, Actor[]>);

  const actorTypeIcons: Record<string, string> = {
    patient: '🏥',
    doctor: '👨‍⚕️',
    pharmacy: '💊',
    insurance: '🏦'
  };

  const actorTypeOrder = ['patient', 'doctor', 'pharmacy', 'insurance'];

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="bg-gray-800 rounded-lg shadow-lg p-8 max-w-2xl w-full">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">🩺 BSV Medical System</h1>
          <p className="text-gray-300">Select your profile to continue</p>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500 text-red-500 p-4 rounded-lg mb-6">
            {error}
          </div>
        )}

        {isLoading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto"></div>
            <p className="text-gray-300 mt-4">Loading actors...</p>
          </div>
        ) : actors.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-300 mb-4">No actors found. Please create actors first.</p>
            <button
              onClick={() => navigate('/setup')}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition-colors"
            >
              Setup Actors
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {actorTypeOrder
              .filter(type => groupedActors[type]) // Only show types that have actors
              .map((type) => {
                const typeActors = groupedActors[type];
                const displayName = type === 'pharmacy' ? 'Pharmacist' : 
                                  type === 'insurance' ? 'Insurer' : 
                                  type.charAt(0).toUpperCase() + type.slice(1);
                
                return (
                  <div key={type}>
                    <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                      <span>{actorTypeIcons[type] || '👤'}</span>
                      <span>{displayName}s</span>
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {typeActors.map((actor) => (
                        <button
                          key={actor.id}
                          onClick={() => handleActorSelection(actor)}
                          className={`p-6 rounded-lg border-2 transition-all cursor-pointer border-gray-600 hover:border-gray-500 bg-gray-800 hover:bg-gray-700`}
                        >
                          <h3 className="text-lg font-semibold mb-2">{actor.name}</h3>
                          {actor.did && (
                            <p className="text-sm text-gray-400 truncate" title={actor.did}>
                              {actor.did}
                            </p>
                          )}
                          {actor.email && (
                            <p className="text-sm text-gray-400">{actor.email}</p>
                          )}
                          {actor.licenseNumber && (
                            <p className="text-sm text-gray-400">
                              License: {actor.licenseNumber}
                            </p>
                          )}
                          {actor.specialization && (
                            <p className="text-sm text-gray-400">
                              {actor.specialization}
                            </p>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </div>
    </div>
  );
};

export default Login;
