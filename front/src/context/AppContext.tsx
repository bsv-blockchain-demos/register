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
  PrescriptionFlow,
  FraudPreventionPrescription,
  SelectiveDisclosure,
  FraudAlert
} from '../types';

// Actions
type AppAction =
  | { type: 'SET_CURRENT_ACTOR'; payload: Actor | null }
  | { type: 'SET_ACTORS'; payload: Actor[] }
  | { type: 'ADD_ACTOR'; payload: Actor }
  | { type: 'UPDATE_ACTOR'; payload: Actor }
  | { type: 'REMOVE_ACTOR'; payload: string } // payload is actor id
  | { type: 'SET_PRESCRIPTIONS'; payload: PrescriptionCredential[] }
  | { type: 'ADD_PRESCRIPTION'; payload: PrescriptionCredential }
  | { type: 'UPDATE_PRESCRIPTION'; payload: PrescriptionCredential }
  | { type: 'ADD_DISPENSATION'; payload: DispensationCredential }
  | { type: 'ADD_CONFIRMATION'; payload: ConfirmationCredential }
  | { type: 'ADD_TOKEN'; payload: BSVToken }
  | { type: 'UPDATE_TOKEN'; payload: BSVToken }
  // Fraud Prevention Actions
  | { type: 'SET_FRAUD_PREVENTION_PRESCRIPTIONS'; payload: FraudPreventionPrescription[] }
  | { type: 'ADD_FRAUD_PREVENTION_PRESCRIPTION'; payload: FraudPreventionPrescription }
  | { type: 'UPDATE_FRAUD_PREVENTION_PRESCRIPTION'; payload: FraudPreventionPrescription }
  | { type: 'ADD_SELECTIVE_DISCLOSURE'; payload: SelectiveDisclosure }
  | { type: 'ADD_FRAUD_ALERT'; payload: FraudAlert }
  | { type: 'CLEAR_FRAUD_ALERTS' }
  | { type: 'RESET_STATE' };

// Initial state
const initialState: AppState = {
  currentActor: null,
  actors: [],
  prescriptions: [],
  dispensations: [],
  confirmations: [],
  tokens: [],
  // Fraud Prevention State
  fraudPreventionPrescriptions: [],
  selectiveDisclosures: [],
  fraudAlerts: []
};

// Reducer
function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_CURRENT_ACTOR':
      return {
        ...state,
        currentActor: action.payload
      };

    case 'SET_ACTORS':
      return {
        ...state,
        actors: action.payload
      };

    case 'ADD_ACTOR': {
      // Check if actor already exists to prevent duplicates
      const exists = state.actors.some(actor => actor.id === action.payload.id);
      if (exists) {
        return state;
      }
      return {
        ...state,
        actors: [...state.actors, action.payload]
      };
    }

    case 'UPDATE_ACTOR': {
      return {
        ...state,
        actors: state.actors.map(actor => 
          actor.id === action.payload.id ? action.payload : actor
        ),
        currentActor: state.currentActor?.id === action.payload.id 
          ? action.payload 
          : state.currentActor
      };
    }

    case 'REMOVE_ACTOR': {
      return {
        ...state,
        actors: state.actors.filter(actor => actor.id !== action.payload),
        // Clear current actor if it was removed
        currentActor: state.currentActor?.id === action.payload 
          ? null 
          : state.currentActor
      };
    }

    case 'SET_PRESCRIPTIONS': {
      return {
        ...state,
        prescriptions: action.payload
      };
    }

    case 'ADD_PRESCRIPTION': {
      return {
        ...state,
        prescriptions: [...state.prescriptions, action.payload]
      };
    }

    case 'UPDATE_PRESCRIPTION': {
      return {
        ...state,
        prescriptions: state.prescriptions.map(prescription =>
          prescription.id === action.payload.id ? action.payload : prescription
        )
      };
    }

    case 'ADD_DISPENSATION': {
      return {
        ...state,
        dispensations: [...state.dispensations, action.payload]
      };
    }

    case 'ADD_CONFIRMATION': {
      return {
        ...state,
        confirmations: [...state.confirmations, action.payload]
      };
    }

    case 'ADD_TOKEN': {
      return {
        ...state,
        tokens: [...state.tokens, action.payload]
      };
    }

    case 'UPDATE_TOKEN': {
      return {
        ...state,
        tokens: state.tokens.map(token =>
          token.txid === action.payload.txid && token.vout === action.payload.vout
            ? action.payload
            : token
        )
      };
    }

    // Fraud Prevention Cases
    case 'SET_FRAUD_PREVENTION_PRESCRIPTIONS': {
      return {
        ...state,
        fraudPreventionPrescriptions: action.payload
      };
    }

    case 'ADD_FRAUD_PREVENTION_PRESCRIPTION': {
      const exists = state.fraudPreventionPrescriptions.some(p => p.id === action.payload.id);
      if (exists) {
        return state;
      }
      return {
        ...state,
        fraudPreventionPrescriptions: [...state.fraudPreventionPrescriptions, action.payload]
      };
    }

    case 'UPDATE_FRAUD_PREVENTION_PRESCRIPTION': {
      return {
        ...state,
        fraudPreventionPrescriptions: state.fraudPreventionPrescriptions.map(prescription =>
          prescription.id === action.payload.id ? action.payload : prescription
        )
      };
    }

    case 'ADD_SELECTIVE_DISCLOSURE': {
      return {
        ...state,
        selectiveDisclosures: [...state.selectiveDisclosures, action.payload]
      };
    }

    case 'ADD_FRAUD_ALERT': {
      return {
        ...state,
        fraudAlerts: [...state.fraudAlerts, action.payload]
      };
    }

    case 'CLEAR_FRAUD_ALERTS': {
      return {
        ...state,
        fraudAlerts: []
      };
    }

    case 'RESET_STATE': {
      return initialState;
    }

    default: {
      return state;
    }
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
  // Fraud Prevention helpers
  getCurrentFraudPreventionPrescriptions: () => FraudPreventionPrescription[];
  getFraudAlertsByPrescription: (prescriptionId: string) => FraudAlert[];
  getSelectiveDisclosuresByActor: (actorType: 'insurance' | 'pharmacy' | 'audit') => SelectiveDisclosure[];
  getHighRiskPrescriptions: () => FraudPreventionPrescription[];
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

  // Fraud Prevention Helper Functions
  const getCurrentFraudPreventionPrescriptions = (): FraudPreventionPrescription[] => {
    if (!state.currentActor?.did) return [];
    
    return state.fraudPreventionPrescriptions.filter(prescription => {
      if (state.currentActor?.type === 'patient') {
        return prescription.patientDid === state.currentActor.did;
      } else if (state.currentActor?.type === 'doctor') {
        return prescription.doctorDid === state.currentActor.did;
      } else if (state.currentActor?.type === 'insurance') {
        return prescription.patientInfo.insuranceProvider === state.currentActor.name;
      } else if (state.currentActor?.type === 'pharmacy') {
        // Pharmacies see prescriptions they can verify/dispense
        return prescription.status === 'created' || prescription.status === 'verified';
      } else if (state.currentActor?.type === 'auditor') {
        // Auditors see all prescriptions
        return true;
      }
      return false;
    });
  };

  const getFraudAlertsByPrescription = (prescriptionId: string): FraudAlert[] => {
    return state.fraudAlerts.filter(alert => alert.prescriptionId === prescriptionId);
  };

  const getSelectiveDisclosuresByActor = (actorType: 'insurance' | 'pharmacy' | 'audit'): SelectiveDisclosure[] => {
    if (!state.currentActor?.did) return [];
    
    return state.selectiveDisclosures.filter(disclosure => 
      disclosure.actorType === actorType && disclosure.requestorDid === state.currentActor?.did
    );
  };

  const getHighRiskPrescriptions = (): FraudPreventionPrescription[] => {
    return state.fraudPreventionPrescriptions.filter(prescription => 
      prescription.fraudScore !== undefined && prescription.fraudScore >= 50
    );
  };

  const contextValue: AppContextType = {
    state,
    dispatch,
    getCurrentPrescriptions,
    getCurrentDispensations,
    getCurrentTokens,
    getActorByDid,
    getPrescriptionFlows,
    // Fraud Prevention helpers
    getCurrentFraudPreventionPrescriptions,
    getFraudAlertsByPrescription,
    getSelectiveDisclosuresByActor,
    getHighRiskPrescriptions
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
