import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiService } from '../services/apiService';
import type { Actor } from '../types';

const Login: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [actors, setActors] = useState<Actor[]>([]);
  const [selectedActor, setSelectedActor] = useState<Actor | null>(null);
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

  const handleLogin = () => {
    if (selectedActor) {
      login(selectedActor);
      navigate('/dashboard');
    }
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
            {Object.entries(groupedActors).map(([type, typeActors]) => (
              <div key={type}>
                <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                  <span>{actorTypeIcons[type] || '👤'}</span>
                  <span className="capitalize">{type}s</span>
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {typeActors.map((actor) => (
                    <button
                      key={actor.id}
                      onClick={() => setSelectedActor(actor)}
                      className={`p-4 rounded-lg border-2 transition-all text-left ${
                        selectedActor?.id === actor.id
                          ? 'border-blue-500 bg-blue-500/20'
                          : 'border-gray-600 bg-gray-700 hover:border-gray-500'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="font-medium text-white">{actor.name}</h3>
                          <p className="text-sm text-gray-400 mt-1">{actor.email}</p>
                          {actor.did && (
                            <p className="text-xs text-gray-500 mt-2 font-mono truncate">
                              {actor.did}
                            </p>
                          )}
                        </div>
                        {selectedActor?.id === actor.id && (
                          <div className="text-blue-500">
                            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                          </div>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
            
            <div className="flex justify-center mt-8">
              <button
                onClick={handleLogin}
                disabled={!selectedActor}
                className={`px-8 py-3 rounded-lg font-medium transition-all ${
                  selectedActor
                    ? 'bg-blue-600 hover:bg-blue-700 text-white'
                    : 'bg-gray-700 text-gray-400 cursor-not-allowed'
                }`}
              >
                Login as {selectedActor?.name || 'Select an actor'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Login;
