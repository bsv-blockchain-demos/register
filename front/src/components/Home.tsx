import { useApp } from '../context/AppContext';

export default function Home() {
  const { state } = useApp();

  // Mock data for demo purposes
  const stats = {
    activeActors: state.actors?.length || 0,
    prescriptionFlows: 0,
    bsvTokens: 0
  };

  return (
    <div>
      <div className="dashboard-welcome">
        <h1>
          🌟 Welcome to the BSV Medical Demo
        </h1>
        <p>
          Experience the complete lifecycle of medical prescriptions using Decentralized Identifiers (DIDs) and Verifiable Credentials (VCs) on Bitcoin SV
        </p>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-number">{stats.activeActors}</div>
          <div className="stat-label">Active Actors</div>
        </div>
        <div className="stat-card">
          <div className="stat-number">{stats.prescriptionFlows}</div>
          <div className="stat-label">Prescription Flows</div>
        </div>
        <div className="stat-card">
          <div className="stat-number">{stats.bsvTokens}</div>
          <div className="stat-label">BSV Tokens</div>
        </div>
      </div>

      <div className="workflow-section">
        <h2 className="workflow-title">
          📋 Medical Prescription Workflow
        </h2>
        <div className="workflow-steps">
          <div className="workflow-step">
            <div className="step-number">1</div>
            <div className="step-content">
              <h3>👩‍⚕️ Doctor Creates Prescription</h3>
              <p>Doctor issues a verifiable prescription credential for the patient</p>
            </div>
          </div>
          <div className="workflow-step">
            <div className="step-number">2</div>
            <div className="step-content">
              <h3>⚡ BSV Token Creation</h3>
              <p>Prescription is tokenized on the Bitcoin SV blockchain</p>
            </div>
          </div>
          <div className="workflow-step">
            <div className="step-number">3</div>
            <div className="step-content">
              <h3>💊 Pharmacy Dispenses</h3>
              <p>Pharmacy validates and dispenses medication, updating token status</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
