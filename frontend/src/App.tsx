/**
 * Root application component with routing and auth state.
 */

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import DashboardPage from './pages/DashboardPage';
import ScanDetailPage from './pages/ScanDetailPage';
import ScanHistoryPage from './pages/ScanHistoryPage';
import ComparePage from './pages/ComparePage';

function App() {
  const { user, loading, error, login, signup, logout, setError } = useAuth();

  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes */}
        <Route
          path="/login"
          element={
            user ? (
              <Navigate to="/" replace />
            ) : (
              <LoginPage onLogin={login} error={error} setError={setError} />
            )
          }
        />
        <Route
          path="/signup"
          element={
            user ? (
              <Navigate to="/" replace />
            ) : (
              <SignupPage onSignup={signup} error={error} setError={setError} />
            )
          }
        />

        {/* Protected routes */}
        <Route
          path="/"
          element={
            <ProtectedRoute user={user} loading={loading}>
              <Layout user={user} onLogout={logout}>
                <DashboardPage user={user!} />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/scans/:scanId"
          element={
            <ProtectedRoute user={user} loading={loading}>
              <Layout user={user} onLogout={logout}>
                <ScanDetailPage />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/repos/:repoId/history"
          element={
            <ProtectedRoute user={user} loading={loading}>
              <Layout user={user} onLogout={logout}>
                <ScanHistoryPage />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/scans/:scanId/compare/:otherId"
          element={
            <ProtectedRoute user={user} loading={loading}>
              <Layout user={user} onLogout={logout}>
                <ComparePage />
              </Layout>
            </ProtectedRoute>
          }
        />

        {/* Catch-all redirect */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
