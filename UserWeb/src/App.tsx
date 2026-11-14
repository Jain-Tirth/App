import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { api } from './api';
import { hasErrorCode } from './apiError';
import { ConsentGate } from './components/ConsentPanels';
import { ErrorNotice } from './components/ErrorNotice';
import { describeError, type FriendlyError } from './errors/messages';
import type { KycStatus, KycVerification, LoginResponse, ProfileResponse } from './types';
import { LandingPage } from './pages/LandingPage';
import { OtpPage } from './pages/OtpPage';
import { LoginPage } from './pages/LoginPage';
import { SignupPage, type OtpContext } from './pages/SignupPage';
import { KycPage } from './pages/KycPage';
import { PendingPage } from './pages/PendingPage';
import { WizardPage } from './pages/RegisterPage';
import { AppPage } from './pages/AppPage';

const OTP_CONTEXT_KEY = 'user_otp_context';

/** Statuses from which the member may wait on the review screen. */
const SUBMITTED_KYC: KycStatus[] = ['needsReview', 'changesNeeded', 'failed', 'approved'];

function readOtpContext(): OtpContext | null {
  try {
    const raw = sessionStorage.getItem(OTP_CONTEXT_KEY);
    return raw ? (JSON.parse(raw) as OtpContext) : null;
  } catch {
    return null;
  }
}

function Spinner({ label }: { label: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-brand-canvas">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-3 border-brand-primary border-t-transparent" />
        <span className="text-xs font-semibold uppercase tracking-wider text-brand-muted">{label}</span>
      </div>
    </div>
  );
}

function AppRouter() {
  const [accessToken, setAccessToken] = useState<string | null>(
    localStorage.getItem('user_access_token'),
  );
  const [, setRefreshToken] = useState<string | null>(localStorage.getItem('user_refresh_token'));
  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [loadingInitial, setLoadingInitial] = useState(Boolean(accessToken));
  const [loadError, setLoadError] = useState<FriendlyError | null>(null);
  const [otpContext, setOtpContext] = useState<OtpContext | null>(readOtpContext);
  const [kyc, setKyc] = useState<KycVerification | null>(null);
  const [kycChecked, setKycChecked] = useState(false);

  const clearSession = useCallback(() => {
    localStorage.removeItem('user_access_token');
    localStorage.removeItem('user_refresh_token');
    setAccessToken(null);
    setRefreshToken(null);
    setProfile(null);
    setKyc(null);
    setKycChecked(false);
  }, []);

  const loadProfile = useCallback(
    async (token: string) => {
      try {
        const response = await api.getMyProfile(token);
        setProfile(response);
        setLoadError(null);
      } catch (err) {
        if (hasErrorCode(err, 'UNAUTHORIZED')) {
          clearSession();
        } else {
          setLoadError(describeError(err, 'profile'));
        }
      } finally {
        setLoadingInitial(false);
      }
    },
    [clearSession],
  );

  useEffect(() => {
    if (accessToken) {
      void loadProfile(accessToken);
    } else {
      setLoadingInitial(false);
      setProfile(null);
    }
  }, [accessToken, loadProfile]);

  const accountStatus = profile?.profile?.user?.accountStatus;
  const isApproved = accountStatus === 'active';
  const isProfileComplete =
    Boolean(profile?.profile) && (profile?.completion?.completedSteps ?? 0) >= 5;

  // Once the profile is complete and not yet approved, the review step also needs the KYC case.
  useEffect(() => {
    if (!accessToken || !isProfileComplete || isApproved || kycChecked) return;
    let cancelled = false;
    api
      .getKycVerification(accessToken)
      .then((verification) => {
        if (!cancelled) setKyc(verification);
      })
      .catch((err: unknown) => {
        // A missing case means the member has not started; other failures are reported by the KYC page.
        if (!cancelled && !hasErrorCode(err, 'VERIFICATION_NOT_FOUND')) setKyc(null);
      })
      .finally(() => {
        if (!cancelled) setKycChecked(true);
      });
    return () => {
      cancelled = true;
    };
  }, [accessToken, isProfileComplete, isApproved, kycChecked]);

  function handleAuth(response: LoginResponse) {
    localStorage.setItem('user_access_token', response.tokens.accessToken);
    localStorage.setItem('user_refresh_token', response.tokens.refreshToken);
    sessionStorage.removeItem(OTP_CONTEXT_KEY);
    setOtpContext(null);
    // Hold the router on a spinner until the profile arrives, so the member lands on the right step.
    setLoadingInitial(true);
    setKycChecked(false);
    setAccessToken(response.tokens.accessToken);
    setRefreshToken(response.tokens.refreshToken);
  }

  function handleRegistered(context: OtpContext) {
    sessionStorage.setItem(OTP_CONTEXT_KEY, JSON.stringify(context));
    setOtpContext(context);
  }

  const handleKycChange = useCallback((verification: KycVerification | null) => {
    setKyc(verification);
    setKycChecked(true);
  }, []);

  const kycSubmitted = kyc !== null && SUBMITTED_KYC.includes(kyc.status);

  function member(token: string, page: ReactNode) {
    return <ConsentGate token={token}>{page}</ConsentGate>;
  }

  if (loadingInitial) {
    return <Spinner label="Loading Dhobi Matrimony..." />;
  }

  if (accessToken && loadError && !profile) {
    return (
      <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 px-4">
        <ErrorNotice error={loadError} testId="app-load-error" />
        <button
          type="button"
          data-testid="app-load-retry"
          onClick={() => {
            setLoadError(null);
            setLoadingInitial(true);
            void loadProfile(accessToken);
          }}
          className="rounded-xl bg-brand-primary px-5 py-2.5 text-sm font-semibold text-white"
        >
          Try again
        </button>
        <button type="button" onClick={clearSession} className="text-xs text-brand-muted underline">
          Sign out
        </button>
      </div>
    );
  }

  const nextStepPath = isApproved ? '/app' : isProfileComplete ? '/pending' : '/register';

  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route
        path="/signup"
        element={
          accessToken ? <Navigate to={nextStepPath} replace /> : <SignupPage onRegistered={handleRegistered} />
        }
      />
      <Route
        path="/otp"
        element={
          accessToken ? (
            <Navigate to={nextStepPath} replace />
          ) : (
            <OtpPage otpContext={otpContext} onVerified={handleAuth} />
          )
        }
      />
      <Route
        path="/login"
        element={
          accessToken ? <Navigate to={nextStepPath} replace /> : <LoginPage onLoggedIn={handleAuth} />
        }
      />
      <Route
        path="/register"
        element={
          accessToken ? (
            member(
              accessToken,
              <WizardPage token={accessToken} profile={profile} onProfileUpdate={setProfile} />,
            )
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
      <Route
        path="/kyc"
        element={
          accessToken ? (
            isApproved ? (
              <Navigate to="/app" replace />
            ) : !isProfileComplete ? (
              <Navigate to="/register" replace />
            ) : (
              member(
                accessToken,
                <KycPage token={accessToken} onKycChange={handleKycChange} onLogout={clearSession} />,
              )
            )
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
            ) : !isProfileComplete ? (
              <Navigate to="/register" replace />
            ) : !kycChecked ? (
              <Spinner label="Checking your verification..." />
            ) : !kycSubmitted ? (
              <Navigate to="/kyc" replace />
            ) : (
              member(
                accessToken,
                <PendingPage
                  token={accessToken}
                  profile={profile}
                  onProfileUpdate={setProfile}
                  onLogout={clearSession}
                />,
              )
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
              member(
                accessToken,
                <AppPage
                  token={accessToken}
                  profile={profile}
                  onLogout={clearSession}
                  onProfileUpdate={setProfile}
                />,
              )
            ) : (
              <Navigate to={nextStepPath} replace />
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
