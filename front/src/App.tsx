// src/App.tsx
import { Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { ActorManagement } from './components/ActorManagement';
import PrescriptionWorkflow from './components/PrescriptionWorkflow';
import PrescriptionDashboard from './components/PrescriptionDashboard';
import QRScanner from './components/QRScanner';
import DIDResolver from './components/DidResolver';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import ProtectedRoute from './components/ProtectedRoute';

function App() {
  const location = useLocation();
  const { isAuthenticated, currentUser, logout } = useAuth();

  // Public routes that don't require authentication
  const publicPaths = ['/login', '/setup'];
  const isPublicPath = publicPaths.includes(location.pathname);

  // If not authenticated and not on a public path, redirect to login
  if (!isAuthenticated && !isPublicPath) {
    return <Navigate to="/login" replace />;
  }

  // If authenticated and on login page, redirect to dashboard
  if (isAuthenticated && location.pathname === '/login') {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Only show navigation if authenticated */}
      {isAuthenticated && (
        <nav className="w-64 bg-gray-800 border-r border-gray-700 p-4 fixed h-full overflow-y-auto">
          <div className="space-y-4">
            <div className="border-b border-gray-700 pb-4">
              <h2 className="text-lg font-semibold">🩺 BlockMed</h2>
              {currentUser && (
                <div className="mt-2">
                  <p className="text-sm text-gray-400">Logged in as:</p>
                  <p className="text-sm font-medium text-white">{currentUser.name}</p>
                  <p className="text-xs text-gray-500 capitalize">{currentUser.type}</p>
                </div>
              )}
            </div>
            
            <ul className="space-y-2 p-4 pt-0">
              {/* Dashboard - Available to all users */}
              <li>
                <Link 
                  to="/dashboard" 
                  className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors hover:bg-gray-700 ${
                    location.pathname === '/dashboard' ? 'bg-blue-600 text-white' : 'text-gray-300'
                  }`}
                >
                  🏠 Dashboard
                </Link>
              </li>
              
              {/* Admin-only pages */}
              {currentUser?.type === 'admin' && (
                <>
                  <li>
                    <Link 
                      to="/prescription-dashboard" 
                      className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors hover:bg-gray-700 ${
                        location.pathname === '/prescription-dashboard' ? 'bg-blue-600 text-white' : 'text-gray-300'
                      }`}
                    >
                      📊 Prescriptions
                    </Link>
                  </li>
                  
                  <li>
                    <Link 
                      to="/qr-scanner" 
                      className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors hover:bg-gray-700 ${
                        location.pathname === '/qr-scanner' ? 'bg-blue-600 text-white' : 'text-gray-300'
                      }`}
                    >
                      📷 QR Scanner
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
                </>
              )}
            </ul>
            
            <div className="pt-4 border-t border-gray-700">
              <button
                onClick={logout}
                className="w-full flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium text-gray-300 hover:bg-gray-700 transition-colors"
              >
                🚪 Logout
              </button>
            </div>
          </div>
        </nav>
      )}

      <main className={isAuthenticated ? "ml-64 p-8" : ""}>
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/setup" element={<ActorManagement />} />
          
          {/* Protected routes */}
          <Route path="/" element={
            <ProtectedRoute>
              <Navigate to="/dashboard" replace />
            </ProtectedRoute>
          } />
          
          <Route path="/dashboard" element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          } />
          
          <Route path="/actors" element={
            <ProtectedRoute allowedRoles={['admin']}>
              <ActorManagement />
            </ProtectedRoute>
          } />
          
          <Route path="/prescription" element={
            <ProtectedRoute allowedRoles={['doctor', 'admin']}>
              <PrescriptionWorkflow />
            </ProtectedRoute>
          } />
          
          <Route path="/prescription-dashboard" element={
            <ProtectedRoute allowedRoles={['admin']}>
              <PrescriptionDashboard />
            </ProtectedRoute>
          } />
          
          <Route path="/qr-scanner" element={
            <ProtectedRoute allowedRoles={['admin']}>
              <QRScanner />
            </ProtectedRoute>
          } />
          
          <Route path="/did-resolver" element={
            <ProtectedRoute allowedRoles={['admin']}>
              <DIDResolver />
            </ProtectedRoute>
          } />
        </Routes>
      </main>
    </div>
  );
}

export default App;
