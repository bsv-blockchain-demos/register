// src/context/AppContext.tsx
import React, { createContext, useContext, useReducer } from 'react';
import type { ReactNode } from 'react';
import type { 
  AppState, 
  Actor, 
  PrescriptionCredential,
  DispensationCredential,
  ConfirmationCredential,
  BSVToken,
  PrescriptionFlow
} from '../types';

// Actions
type AppAction =
  | { type: 'SET_CURRENT_ACTOR'; payload: Actor | null }
  | { type: 'ADD_ACTOR'; payload: Actor }
  | { type: 'UPDATE_ACTOR'; payload: Actor }
  | { type: 'REMOVE_ACTOR'; payload: string } // payload is actor id
  | { type: 'ADD_PRESCRIPTION'; payload: PrescriptionCredential }
  | { type: 'UPDATE_PRESCRIPTION'; payload: PrescriptionCredential }
  | { type: 'ADD_DISPENSATION'; payload: DispensationCredential }
  | { type: 'ADD_CONFIRMATION'; payload: ConfirmationCredential }
  | { type: 'ADD_TOKEN'; payload: BSVToken }
  | { type: 'UPDATE_TOKEN'; payload: BSVToken }
  | { type: 'RESET_STATE' };

// Initial state
const initialState: AppState = {
  currentActor: null,
  actors: [],
  prescriptions: [],
  dispensations: [],
  confirmations: [],
  tokens: []
};

// Reducer
function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_CURRENT_ACTOR':
      return {
        ...state,
        currentActor: action.payload
      };

    case 'ADD_ACTOR':
      return {
        ...state,
        actors: [...state.actors, action.payload]
      };

    case 'UPDATE_ACTOR':
      return {
        ...state,
        actors: state.actors.map(actor => 
          actor.id === action.payload.id ? action.payload : actor
        ),
        currentActor: state.currentActor?.id === action.payload.id 
          ? action.payload 
          : state.currentActor
      };

    case 'REMOVE_ACTOR':
      return {
        ...state,
        actors: state.actors.filter(actor => actor.id !== action.payload),
        // Clear current actor if it was removed
        currentActor: state.currentActor?.id === action.payload 
          ? null 
          : state.currentActor
      };

    case 'ADD_PRESCRIPTION':
      return {
        ...state,
        prescriptions: [...state.prescriptions, action.payload]
      };

    case 'UPDATE_PRESCRIPTION':
      return {
        ...state,
        prescriptions: state.prescriptions.map(prescription =>
          prescription.id === action.payload.id ? action.payload : prescription
        )
      };

    case 'ADD_DISPENSATION':
      return {
        ...state,
        dispensations: [...state.dispensations, action.payload]
      };

    case 'ADD_CONFIRMATION':
      return {
        ...state,
        confirmations: [...state.confirmations, action.payload]
      };

    case 'ADD_TOKEN':
      return {
        ...state,
        tokens: [...state.tokens, action.payload]
      };

    case 'UPDATE_TOKEN':
      return {
        ...state,
        tokens: state.tokens.map(token =>
          token.txid === action.payload.txid && token.vout === action.payload.vout
            ? action.payload
            : token
        )
      };

    case 'RESET_STATE':
      return initialState;

    default:
      return state;
  }
}

// Context
interface AppContextType {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
  // Helper functions
  getCurrentPrescriptions: () => PrescriptionCredential[];
  getCurrentDispensations: () => DispensationCredential[];
  getCurrentTokens: () => BSVToken[];
  getActorByDid: (did: string) => Actor | undefined;
  getPrescriptionFlows: () => PrescriptionFlow[];
}

const AppContext = createContext<AppContextType | undefined>(undefined);

// Provider component
interface AppProviderProps {
  children: ReactNode;
}

export function AppProvider({ children }: AppProviderProps) {
  const [state, dispatch] = useReducer(appReducer, initialState);

  // Helper functions
  const getCurrentPrescriptions = (): PrescriptionCredential[] => {
    if (!state.currentActor?.did) return [];
    
    return state.prescriptions.filter(prescription => {
      if (state.currentActor?.type === 'patient') {
        return prescription.credentialSubject.id === state.currentActor.did;
      } else if (state.currentActor?.type === 'doctor') {
        return prescription.credentialSubject.prescription.doctorId === state.currentActor.did;
      } else if (state.currentActor?.type === 'pharmacy') {
        // Prescriptions that have been dispensed by this pharmacy
        return state.dispensations.some(dispensation => 
          dispensation.credentialSubject.prescription.id === prescription.credentialSubject.prescription.id &&
          dispensation.credentialSubject.prescription.pharmacyId === state.currentActor?.did
        );
      }
      return false;
    });
  };

  const getCurrentDispensations = (): DispensationCredential[] => {
    if (!state.currentActor?.did) return [];
    
    return state.dispensations.filter(dispensation => {
      if (state.currentActor?.type === 'patient') {
        return dispensation.credentialSubject.id === state.currentActor.did;
      } else if (state.currentActor?.type === 'pharmacy') {
        return dispensation.credentialSubject.prescription.pharmacyId === state.currentActor.did;
      }
      return false;
    });
  };

  const getCurrentTokens = (): BSVToken[] => {
    if (!state.currentActor?.did) return [];
    
    return state.tokens.filter(token => 
      token.unlockableBy === state.currentActor?.did
    );
  };

  const getActorByDid = (did: string): Actor | undefined => {
    return state.actors.find(actor => actor.did === did);
  };

  const getPrescriptionFlows = (): PrescriptionFlow[] => {
    // Build prescription flows from available data
    const flows: PrescriptionFlow[] = [];
    
    state.prescriptions.forEach(prescription => {
      const patientDid = prescription.credentialSubject.id; // TODO we got an error on this line.
      const doctorDid = prescription.credentialSubject.prescription.doctorId;
      
      // Find related dispensation
      const dispensation = state.dispensations.find(d => 
        d.credentialSubject.prescription.id === prescription.credentialSubject.prescription.id
      );
      
      // Find related confirmation
      const confirmation = state.confirmations.find(c => 
        c.credentialSubject.confirmation.prescriptionId === prescription.credentialSubject.prescription.id
      );
      
      // Find related tokens
      const relatedTokens = state.tokens.filter(token =>
        token.metadata?.prescriptionId === prescription.credentialSubject.prescription.id
      );
      
      // Determine current stage
      let currentStage: PrescriptionFlow['currentStage'] = 'created';
      if (confirmation) {
        currentStage = 'confirmed';
      } else if (dispensation) {
        currentStage = 'dispensed';
      } else if (relatedTokens.length > 0) {
        currentStage = 'sent_to_pharmacy';
      }
      
      flows.push({
        id: prescription.credentialSubject.prescription.id,
        patientDid,
        doctorDid,
        pharmacyDid: dispensation?.credentialSubject.prescription.pharmacyId,
        insuranceDid: '', // Would be derived from patient info
        currentStage,
        prescriptionVC: prescription,
        dispensationVC: dispensation,
        confirmationVC: confirmation,
        tokens: relatedTokens,
        createdAt: new Date(prescription.credentialSubject.prescription.prescribedDate),
        updatedAt: new Date(confirmation?.credentialSubject.confirmation.confirmedDate || 
                           dispensation?.credentialSubject.prescription.dispensedDate ||
                           prescription.credentialSubject.prescription.prescribedDate)
      });
    });
    
    return flows;
  };

  const contextValue: AppContextType = {
    state,
    dispatch,
    getCurrentPrescriptions,
    getCurrentDispensations,
    getCurrentTokens,
    getActorByDid,
    getPrescriptionFlows
  };

  return (
    <AppContext.Provider value={contextValue}>
      {children}
    </AppContext.Provider>
  );
}

// Hook to use the context
export function useApp() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}

// Export the context type for external use
export type { AppContextType };
