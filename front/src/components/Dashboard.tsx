import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import PatientDashboard from './dashboards/PatientDashboard';
import DoctorDashboard from './dashboards/DoctorDashboard';
import PharmacyDashboard from './dashboards/PharmacyDashboard';
import InsuranceDashboard from './dashboards/InsuranceDashboard';

const Dashboard: React.FC = () => {
  const { currentUser, isAuthenticated } = useAuth();

  if (!isAuthenticated || !currentUser) {
    return <Navigate to="/login" replace />;
  }

  // Route to appropriate dashboard based on user type
  switch (currentUser.type) {
    case 'patient':
      return <PatientDashboard />;
    case 'doctor':
      return <DoctorDashboard />;
    case 'pharmacy':
      return <PharmacyDashboard />;
    case 'insurance':
      return <InsuranceDashboard />;
    default:
      return <Navigate to="/login" replace />;
  }
};

export default Dashboard;
