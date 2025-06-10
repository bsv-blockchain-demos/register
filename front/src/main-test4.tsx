import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

// Minimal test of App component structure
function TestApp() {
  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h1>QuarkID Test App 4</h1>
      <p>Testing App component imports...</p>
      <div>
        <h2>Components we're testing:</h2>
        <ul>
          <li>ActorManagement - Actor creation and management</li>
          <li>PrescriptionWorkflow - Prescription issuance</li>
          <li>PrescriptionDashboard - View prescriptions</li>
          <li>QRScanner - QR code scanning</li>
          <li>TokenManager - BSV token management</li>
          <li>DIDResolver - DID resolution testing</li>
        </ul>
      </div>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <TestApp />
    </BrowserRouter>
  </StrictMode>,
);