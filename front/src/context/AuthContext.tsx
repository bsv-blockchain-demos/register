import React, { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import type { Actor } from '../types';

interface AuthContextType {
  currentUser: Actor | null;
  isAuthenticated: boolean;
  login: (actor: Actor) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<Actor | null>(null);

  // Check for saved session on mount
  useEffect(() => {
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
      try {
        setCurrentUser(JSON.parse(savedUser));
      } catch (error) {
        console.error('Failed to parse saved user:', error);
        localStorage.removeItem('currentUser');
      }
    }
  }, []);

  const login = (actor: Actor) => {
    // Validate that actor has a DID before allowing login
    if (!actor.did || actor.did.trim() === '') {
      console.error('Login failed: Actor does not have a valid DID', actor);
      throw new Error('Cannot log in: This actor does not have a valid DID. Please contact support or re-create this actor.');
    }

    setCurrentUser(actor);
    localStorage.setItem('currentUser', JSON.stringify(actor));
  };

  const logout = () => {
    setCurrentUser(null);
    localStorage.removeItem('currentUser');
  };

  const value = {
    currentUser,
    isAuthenticated: !!currentUser,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
