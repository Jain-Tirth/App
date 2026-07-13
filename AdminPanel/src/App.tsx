import { useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { LoginPage } from './pages/LoginPage';
import { Dashboard } from './pages/Dashboard';
import { ReviewPage } from './pages/ReviewPage';

export default function App() {
  const [token, setToken] = useState<string | null>(
    localStorage.getItem('admin_access_token'),
  );
  const [adminName, setAdminName] = useState<string>(
    localStorage.getItem('admin_name') ?? '',
  );

  function handleLogin(nextToken: string, nextAdminName: string) {
    localStorage.setItem('admin_access_token', nextToken);
    localStorage.setItem('admin_name', nextAdminName);
    setToken(nextToken);
    setAdminName(nextAdminName);
  }

  function handleLogout() {
    localStorage.removeItem('admin_access_token');
    localStorage.removeItem('admin_name');
    setToken(null);
    setAdminName('');
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={
          token ? (
            <Navigate to="/" replace />
          ) : (
            <LoginPage onLogin={handleLogin} />
          )
        }
      />
      <Route
        path="/"
        element={
          token ? (
            <Dashboard token={token} adminName={adminName} onLogout={handleLogout} />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
      <Route
        path="/profiles/:userId"
        element={token ? <ReviewPage token={token} /> : <Navigate to="/login" replace />}
      />
    </Routes>
  );
}
