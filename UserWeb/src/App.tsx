import { useEffect, useState, useCallback } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { api } from './api';
import type { LoginResponse, ProfileResponse, RegisterResponse } from './types';
import { LandingPage } from './pages/LandingPage';
import { OtpPage } from './pages/OtpPage';
import { LoginPage } from './pages/LoginPage';
import { PendingPage } from './pages/PendingPage';
import { WizardPage } from './pages/RegisterPage';
import { AppPage } from './pages/AppPage';

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
  const [, setRefreshToken] = useState<string | null>(
    localStorage.getItem('user_refresh_token'),
  );
  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [loadingInitial, setLoadingInitial] = useState(Boolean(accessToken));
  const [otpContext] = useState<OtpContext | null>(null);

  const loadProfile = useCallback(async (token: string) => {
    try {
      const response = await api.getMyProfile(token);
      setProfile(response);
    } catch {
      localStorage.removeItem('user_access_token');
      localStorage.removeItem('user_refresh_token');
      setAccessToken(null);
      setRefreshToken(null);
      setProfile(null);
    } finally {
      setLoadingInitial(false);
    }
  }, []);

  useEffect(() => {
    if (accessToken) {
      void loadProfile(accessToken);
    } else {
      setLoadingInitial(false);
      setProfile(null);
    }
  }, [accessToken, loadProfile]);

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

  const accountStatus = profile?.profile?.user?.accountStatus;
  const isApproved = accountStatus === 'active';
  const isProfileComplete =
    Boolean(profile?.profile) && (profile?.completion?.completedSteps ?? 0) >= 5;

  if (loadingInitial) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-brand-canvas">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-3 border-brand-primary border-t-transparent" />
          <span className="text-xs font-semibold text-brand-muted tracking-wider uppercase">
            Loading Dhobi Matrimony...
          </span>
        </div>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route
        path="/otp"
        element={<OtpPage otpContext={otpContext} onVerified={handleAuth} />}
      />
      <Route
        path="/login"
        element={
          accessToken ? (
            isApproved ? (
              <Navigate to="/app" replace />
            ) : isProfileComplete ? (
              <Navigate to="/pending" replace />
            ) : (
              <Navigate to="/register" replace />
            )
          ) : (
            <LoginPage onLoggedIn={handleAuth} />
          )
        }
      />
      <Route
        path="/register"
        element={
          accessToken ? (
            <WizardPage
              token={accessToken}
              profile={profile}
              onProfileUpdate={setProfile}
            />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
      <Route
        path="/pending"
        element={
          accessToken ? (
            isApproved ? (
              <Navigate to="/app" replace />
            ) : (
              <PendingPage
                token={accessToken}
                profile={profile}
                onProfileUpdate={setProfile}
                onLogout={logout}
              />
            )
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
      <Route
        path="/app"
        element={
          accessToken ? (
            isApproved ? (
              <AppPage
                token={accessToken}
                profile={profile}
                onLogout={logout}
                onProfileUpdate={setProfile}
              />
            ) : isProfileComplete ? (
              <Navigate to="/pending" replace />
            ) : (
              <Navigate to="/register" replace />
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
