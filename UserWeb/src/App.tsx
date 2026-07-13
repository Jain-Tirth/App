import { useEffect, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { api } from './api';
import type { LoginResponse, ProfileResponse, RegisterResponse } from './types';
import { LandingPage } from './pages/LandingPage';
import { RegisterPage } from './pages/RegisterPage';
import { OtpPage } from './pages/OtpPage';
import { LoginPage } from './pages/LoginPage';
import { PendingPage } from './pages/PendingPage';
import { WizardPage } from './pages/WizardPage';

interface OtpContext {
  countryCode: string;
  mobileNumber: string;
  email: string;
  password: string;
  response: RegisterResponse;
}

function AppRouter() {
  const [accessToken, setAccessToken] = useState<string | null>(
    localStorage.getItem('user_access_token'),
  );
  const [refreshToken, setRefreshToken] = useState<string | null>(
    localStorage.getItem('user_refresh_token'),
  );
  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [otpContext, setOtpContext] = useState<OtpContext | null>(null);

  useEffect(() => {
    async function loadProfile() {
      if (!accessToken) {
        setProfile(null);
        return;
      }

      try {
        const response = await api.getMyProfile(accessToken);
        setProfile(response);
      } catch {
        localStorage.removeItem('user_access_token');
        localStorage.removeItem('user_refresh_token');
        setAccessToken(null);
        setRefreshToken(null);
        setProfile(null);
      }
    }

    void loadProfile();
  }, [accessToken]);

  function handleAuth(response: LoginResponse) {
    localStorage.setItem('user_access_token', response.tokens.accessToken);
    localStorage.setItem('user_refresh_token', response.tokens.refreshToken);
    setAccessToken(response.tokens.accessToken);
    setRefreshToken(response.tokens.refreshToken);
  }

  function logout() {
    localStorage.removeItem('user_access_token');
    localStorage.removeItem('user_refresh_token');
    setAccessToken(null);
    setRefreshToken(null);
    setProfile(null);
  }

  const isProfileComplete = Boolean(profile?.profile) && profile?.completion.completedSteps === 5;

  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/register" element={<RegisterPage onRegistered={setOtpContext} />} />
      <Route
        path="/otp"
        element={<OtpPage otpContext={otpContext} onVerified={handleAuth} />}
      />
      <Route
        path="/login"
        element={accessToken ? <Navigate to="/app" replace /> : <LoginPage onLoggedIn={handleAuth} />}
      />
      <Route
        path="/wizard"
        element={
          accessToken ? (
            <WizardPage token={accessToken} profile={profile} onProfileUpdate={setProfile} />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
      <Route
        path="/pending"
        element={
          accessToken ? (
            <PendingPage profile={profile} onLogout={logout} />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
      <Route
        path="/app"
        element={
          accessToken ? (
            isProfileComplete ? (
              <PendingPage profile={profile} onLogout={logout} />
            ) : (
              <Navigate to="/wizard" replace />
            )
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return <AppRouter />;
}
