// src/App.tsx
import React from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import { useApp } from './context/AppContext';
import ActorManagement from './components/ActorManagement';
import PrescriptionWorkflow from './components/PrescriptionWorkflow';
import QRScanner from './components/QRScanner';
import TokenManager from './components/TokenManager';
import DIDResolver from './components/DIDResolver';
import './App.css';

function App() {
  const { state } = useApp();
  const location = useLocation();

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-content">
          <div className="logo">
            <h1>🏥 BSV Medical Demo</h1>
            <p>Decentralized Identity & Verifiable Credentials on Bitcoin SV</p>
          </div>
          
          {state.currentActor && (
            <div className="current-actor">
              <span className="actor-badge actor-{state.currentActor.type}">
                {state.currentActor.type.toUpperCase()}
              </span>
              <span className="actor-name">{state.currentActor.name}</span>
            </div>
          )}
        </div>
      </header>

      <nav className="app-nav">
        <div className="nav-content">
          <Link 
            to="/actors" 
            className={`nav-link ${location.pathname === '/actors' ? 'active' : ''}`}
          >
            👤 Actor Management
          </Link>
          <Link 
            to="/prescription" 
            className={`nav-link ${location.pathname === '/prescription' ? 'active' : ''}`}
          >
            💊 Prescription Workflow
          </Link>
          <Link 
            to="/qr-scanner" 
            className={`nav-link ${location.pathname === '/qr-scanner' ? 'active' : ''}`}
          >
            📱 QR Scanner
          </Link>
          <Link 
            to="/tokens" 
            className={`nav-link ${location.pathname === '/tokens' ? 'active' : ''}`}
          >
            🪙 Token Manager
          </Link>
          <Link 
            to="/did-resolver" 
            className={`nav-link ${location.pathname === '/did-resolver' ? 'active' : ''}`}
          >
            🔍 DID Resolver
          </Link>
        </div>
      </nav>

      <main className="app-main">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/actors" element={<ActorManagement />} />
          <Route path="/prescription" element={<PrescriptionWorkflow />} />
          <Route path="/qr-scanner" element={<QRScanner />} />
          <Route path="/tokens" element={<TokenManager />} />
          <Route path="/did-resolver" element={<DIDResolver />} />
        </Routes>
      </main>

      <footer className="app-footer">
        <div className="footer-content">
          <p>
            Demo of BSV DIDs and Verifiable Credentials for Medical Prescriptions
          </p>
          <p className="tech-stack">
            Built with React • Bitcoin SV • QuarkID • TypeScript
          </p>
        </div>
      </footer>
    </div>
  );
}

function Home() {
  const { state } = useApp();
  const flows = state.prescriptions.length;
  const actors = state.actors.length;
  const tokens = state.tokens.length;

  return (
    <div className="home">
      <div className="hero">
        <h2>🌟 Welcome to the BSV Medical Demo</h2>
        <p className="hero-subtitle">
          Experience the complete lifecycle of medical prescriptions using 
          Decentralized Identifiers (DIDs) and Verifiable Credentials (VCs) on Bitcoin SV
        </p>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon">👥</div>
          <div className="stat-value">{actors}</div>
          <div className="stat-label">Active Actors</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">💊</div>
          <div className="stat-value">{flows}</div>
          <div className="stat-label">Prescription Flows</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">🪙</div>
          <div className="stat-value">{tokens}</div>
          <div className="stat-label">BSV Tokens</div>
        </div>
      </div>

      <div className="workflow-overview">
        <h3>📋 Medical Prescription Workflow</h3>
        <div className="workflow-steps">
          <div className="workflow-step">
            <div className="step-number">1</div>
            <div className="step-content">
              <h4>👩‍⚕️ Doctor Creates Prescription</h4>
              <p>Doctor issues a verifiable prescription credential for the patient</p>
            </div>
          </div>
          <div className="workflow-step">
            <div className="step-number">2</div>
            <div className="step-content">
              <h4>🪙 BSV Token Creation</h4>
              <p>Prescription is tokenized on the Bitcoin SV blockchain</p>
            </div>
          </div>
          <div className="workflow-step">
            <div className="step-number">3</div>
            <div className="step-content">
              <h4>🏥 Pharmacy Dispensation</h4>
              <p>Pharmacy verifies prescription and creates dispensation credential</p>
            </div>
          </div>
          <div className="workflow-step">
            <div className="step-number">4</div>
            <div className="step-content">
              <h4>✅ Confirmation & Settlement</h4>
              <p>Final confirmation credential and blockchain settlement</p>
            </div>
          </div>
        </div>
      </div>

      <div className="getting-started">
        <h3>🚀 Getting Started</h3>
        <div className="getting-started-content">
          <p>
            To begin exploring the medical prescription workflow:
          </p>
          <ol>
            <li>Create actors (Patient, Doctor, Pharmacy) in <Link to="/actors">Actor Management</Link></li>
            <li>Start a prescription flow in <Link to="/prescription">Prescription Workflow</Link></li>
            <li>Scan QR codes to exchange credentials using the <Link to="/qr-scanner">QR Scanner</Link></li>
            <li>Monitor BSV tokens and transfers in <Link to="/tokens">Token Manager</Link></li>
            <li>Resolve DIDs and view credentials in <Link to="/did-resolver">DID Resolver</Link></li>
          </ol>
        </div>
      </div>

      {!state.currentActor && (
        <div className="call-to-action">
          <div className="cta-content">
            <h3>👤 No Actor Selected</h3>
            <p>Select or create an actor to begin the medical prescription demo</p>
            <Link to="/actors" className="cta-button">
              Manage Actors
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
