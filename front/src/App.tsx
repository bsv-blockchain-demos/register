// src/App.tsx
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import { useApp } from './context/AppContext';
import { ActorManagement } from './components/ActorManagement';
import PrescriptionWorkflow from './components/PrescriptionWorkflow';
import PrescriptionDashboard from './components/PrescriptionDashboard';
import QRScanner from './components/QRScanner';
import TokenManager from './components/TokenManager';
import DIDResolver from './components/DidResolver';
import { Button } from '@/components/ui/button';

function App() {
  const location = useLocation();

  // Test div to verify Tailwind classes are working
  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <nav className="w-64 bg-gray-800 border-r border-gray-700 p-4 fixed h-full overflow-y-auto">
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">🩺 BSV Medical Demo</h2>
          <ul className="space-y-2">
            <li>
              <Link 
                to="/" 
                className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors hover:bg-gray-700 ${
                  location.pathname === '/' ? 'bg-blue-600 text-white' : 'text-gray-300'
                }`}
              >
                🏠 Home
              </Link>
            </li>
            <li>
              <Link 
                to="/actors" 
                className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors hover:bg-gray-700 ${
                  location.pathname === '/actors' ? 'bg-blue-600 text-white' : 'text-gray-300'
                }`}
              >
                👤 Actor Management
              </Link>
            </li>
            <li>
              <Link 
                to="/prescription" 
                className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors hover:bg-gray-700 ${
                  location.pathname === '/prescription' ? 'bg-blue-600 text-white' : 'text-gray-300'
                }`}
              >
                💊 Prescription Workflow
              </Link>
            </li>
            <li>
              <Link 
                to="/prescription-dashboard" 
                className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors hover:bg-gray-700 ${
                  location.pathname === '/prescription-dashboard' ? 'bg-blue-600 text-white' : 'text-gray-300'
                }`}
              >
                📊 Prescription Dashboard
              </Link>
            </li>
            <li>
              <Link 
                to="/qr-scanner" 
                className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors hover:bg-gray-700 ${
                  location.pathname === '/qr-scanner' ? 'bg-blue-600 text-white' : 'text-gray-300'
                }`}
              >
                📱 QR Scanner
              </Link>
            </li>
            <li>
              <Link 
                to="/tokens" 
                className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors hover:bg-gray-700 ${
                  location.pathname === '/tokens' ? 'bg-blue-600 text-white' : 'text-gray-300'
                }`}
              >
                🪙 Token Manager
              </Link>
            </li>
            <li>
              <Link 
                to="/did-resolver" 
                className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors hover:bg-gray-700 ${
                  location.pathname === '/did-resolver' ? 'bg-blue-600 text-white' : 'text-gray-300'
                }`}
              >
                🔍 DID Resolver
              </Link>
            </li>
          </ul>
        </div>
      </nav>

      <main className="ml-64 p-8">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/actors" element={<ActorManagement />} />
          <Route path="/prescription" element={<PrescriptionWorkflow />} />
          <Route path="/prescription-dashboard" element={<PrescriptionDashboard />} />
          <Route path="/qr-scanner" element={<QRScanner />} />
          <Route path="/tokens" element={<TokenManager />} />
          <Route path="/did-resolver" element={<DIDResolver />} />
        </Routes>
      </main>
    </div>
  );
}

function Home() {
  const { state } = useApp();
  const flows = state.prescriptions.length;
  const actors = state.actors.length;
  const tokens = state.tokens.length;

  return (
    <div className="space-y-6 p-4 text-white">
      <div className="bg-blue-500 p-4 rounded-lg">
        <h1 className="text-2xl font-bold">🌟 Welcome to the BSV Medical Demo</h1>
        <p className="text-base mt-2">
          Experience the complete lifecycle of medical prescriptions using 
          Decentralized Identifiers (DIDs) and Verifiable Credentials (VCs) on Bitcoin SV
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-green-500 p-4 rounded-lg text-center">
          <h2 className="text-lg font-semibold">👥 Active Actors</h2>
          <div className="text-3xl font-bold">{actors}</div>
        </div>
        <div className="bg-yellow-500 p-4 rounded-lg text-center">
          <h2 className="text-lg font-semibold">💊 Prescription Flows</h2>
          <div className="text-3xl font-bold">{flows}</div>
        </div>
        <div className="bg-purple-500 p-4 rounded-lg text-center">
          <h2 className="text-lg font-semibold">🪙 BSV Tokens</h2>
          <div className="text-3xl font-bold">{tokens}</div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-start space-x-3 p-4 rounded-lg bg-gray-700/50">
            <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-semibold">1</div>
            <div>
              <h4 className="font-semibold">👩‍⚕️ Doctor Creates Prescription</h4>
              <p className="text-sm text-gray-300">Doctor issues a verifiable prescription credential for the patient</p>
            </div>
          </div>
          <div className="flex items-start space-x-3 p-4 rounded-lg bg-gray-700/50">
            <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-semibold">2</div>
            <div>
              <h4 className="font-semibold">🪙 BSV Token Creation</h4>
              <p className="text-sm text-gray-300">Prescription is tokenized on the Bitcoin SV blockchain</p>
            </div>
          </div>
          <div className="flex items-start space-x-3 p-4 rounded-lg bg-gray-700/50">
            <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-semibold">3</div>
            <div>
              <h4 className="font-semibold">🏥 Pharmacy Dispensation</h4>
              <p className="text-sm text-gray-300">Pharmacy verifies prescription and creates dispensation credential</p>
            </div>
          </div>
          <div className="flex items-start space-x-3 p-4 rounded-lg bg-gray-700/50">
            <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-semibold">4</div>
            <div>
              <h4 className="font-semibold">✅ Confirmation & Settlement</h4>
              <p className="text-sm text-gray-300">Final confirmation credential and blockchain settlement</p>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <p className="text-gray-300">
          To begin exploring the medical prescription workflow:
        </p>
        <ol className="space-y-2 text-sm">
          <li className="flex items-center space-x-2">
            <span className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-semibold">1</span>
            <span>Create actors (Patient, Doctor, Pharmacy) in <Link to="/actors" className="text-blue-600 hover:underline font-medium">Actor Management</Link></span>
          </li>
          <li className="flex items-center space-x-2">
            <span className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-semibold">2</span>
            <span>Start a prescription flow in <Link to="/prescription" className="text-blue-600 hover:underline font-medium">Prescription Workflow</Link></span>
          </li>
          <li className="flex items-center space-x-2">
            <span className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-semibold">3</span>
            <span>Scan QR codes to exchange credentials using the <Link to="/qr-scanner" className="text-blue-600 hover:underline font-medium">QR Scanner</Link></span>
          </li>
          <li className="flex items-center space-x-2">
            <span className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-semibold">4</span>
            <span>Monitor BSV tokens and transfers in <Link to="/tokens" className="text-blue-600 hover:underline font-medium">Token Manager</Link></span>
          </li>
          <li className="flex items-center space-x-2">
            <span className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-semibold">5</span>
            <span>Resolve DIDs and view credentials in <Link to="/did-resolver" className="text-blue-600 hover:underline font-medium">DID Resolver</Link></span>
          </li>
        </ol>
      </div>

      {!state.currentActor && (
        <div className="border-dashed border-2 p-4">
          <h2 className="text-xl font-semibold">👤 No Actor Selected</h2>
          <div className="text-center space-y-4">
            <p className="text-gray-300">Select or create an actor to begin the medical prescription demo</p>
            <Button asChild>
              <Link to="/actors">
                Manage Actors
              </Link>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
