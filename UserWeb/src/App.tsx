import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { api, onAccountDeletionPending, onProfileNotApproved } from './api';
import { clearAllExportRequests } from './lib/exportRequest';
import { DeletedPendingPage } from './pages/DeletedPendingPage';
import { SettingsPage } from './pages/SettingsPage';
import { hasErrorCode } from './apiError';
import { resetCache } from './lib/shortlistCache';
import { routeForStatus } from './lib/profileStatus';
import { ConsentGate } from './components/ConsentPanels';
import { ErrorNotice } from './components/ErrorNotice';
import { describeError, type FriendlyError } from './errors/messages';
import type { LoginResponse, ProfileResponse, ProfileReviewStatus } from './types';
import { LandingPage } from './pages/LandingPage';
import { OtpPage } from './pages/OtpPage';
import { LoginPage } from './pages/LoginPage';
import { SignupPage, type OtpContext } from './pages/SignupPage';
import { KycPage } from './pages/KycPage';
import { PendingPage } from './pages/PendingPage';
import { WizardPage } from './pages/RegisterPage';
import { AppPage } from './pages/AppPage';
import { ProfileDetailPage } from './pages/ProfileDetailPage';
import { InterestsPage } from './pages/InterestsPage';
import { ShortlistsPage } from './pages/ShortlistsPage';

const OTP_CONTEXT_KEY = 'user_otp_context';
const LOGGED_OUT_EVERYWHERE_NOTICE = 'You have been logged out of all devices.';

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

  const [deletion, setDeletion] = useState<{ purgeAt: string | null } | null>(null);
  const [loginNotice, setLoginNotice] = useState<string | null>(null);
  const navigate = useNavigate();

  const clearSession = useCallback(() => {
    localStorage.removeItem('user_access_token');
    localStorage.removeItem('user_refresh_token');
    clearAllExportRequests();
    resetCache();
    setAccessToken(null);
    setRefreshToken(null);
    setProfile(null);
    setDeletion(null);
  }, []);

  // Any call answering 403 ACCOUNT_DELETION_PENDING sends the app to the deleted-pending screen.
  useEffect(() => {
    onAccountDeletionPending((purgeAt) => setDeletion({ purgeAt }));
    return () => onAccountDeletionPending(null);
  }, []);

  const handleLoggedOutEverywhere = useCallback(() => {
    clearSession();
    setLoginNotice(LOGGED_OUT_EVERYWHERE_NOTICE);
  }, [clearSession]);

  const loadProfile = useCallback(
    async (token: string) => {
      try {
        const response = await api.getMyProfile(token);
        setProfile(response);
        setLoadError(null);
      } catch (err) {
        if (hasErrorCode(err, 'UNAUTHORIZED')) {
          clearSession();
        } else if (hasErrorCode(err, 'ACCOUNT_DELETION_PENDING')) {
          // The api layer already switched the app to the deleted-pending screen.
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

  // The status only ever comes from GET /profiles/me. A member with no profile row yet is a draft.
  const reviewStatus: ProfileReviewStatus = profile?.profile?.user?.profileReviewStatus ?? 'draft';
  const isProfileComplete =
    Boolean(profile?.profile) && (profile?.completion?.completedSteps ?? 0) >= 5;

  // Any API answer of PROFILE_NOT_APPROVED means the status moved: refresh it, and the routes redirect.
  useEffect(() => {
    if (!accessToken) return;
    onProfileNotApproved(() => void loadProfile(accessToken));
    return () => onProfileNotApproved(null);
  }, [accessToken, loadProfile]);

  function handleAuth(response: LoginResponse) {
    localStorage.setItem('user_access_token', response.tokens.accessToken);
    localStorage.setItem('user_refresh_token', response.tokens.refreshToken);
    sessionStorage.removeItem(OTP_CONTEXT_KEY);
    setOtpContext(null);
    setLoginNotice(null);
    // Hold the router on a spinner until the profile arrives, so the member lands on the right step.
    setLoadingInitial(true);
    setAccessToken(response.tokens.accessToken);
    setRefreshToken(response.tokens.refreshToken);
  }

  function handleRegistered(context: OtpContext) {
    sessionStorage.setItem(OTP_CONTEXT_KEY, JSON.stringify(context));
    setOtpContext(context);
  }

  function member(token: string, page: ReactNode) {
    return <ConsentGate token={token}>{page}</ConsentGate>;
  }

  // A pending deletion owns every route: one screen with the purge date and the cancel option.
  if (accessToken && deletion) {
    return (
      <Routes>
        <Route
          path="/account-deletion"
          element={
            <DeletedPendingPage
              token={accessToken}
              purgeAt={deletion.purgeAt}
              onLogout={clearSession}
              onCancelled={() => {
                setDeletion(null);
                setLoadError(null);
                setLoadingInitial(true);
                void loadProfile(accessToken);
                navigate('/app', { replace: true });
              }}
            />
          }
        />
        <Route path="*" element={<Navigate to="/account-deletion" replace />} />
      </Routes>
    );
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

  const nextStepPath = routeForStatus(reviewStatus);
  // Members edit their profile and verification while a draft or when changes were requested.
  const mayEdit = reviewStatus === 'draft' || reviewStatus === 'needsChanges';

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
          accessToken ? (
            <Navigate to={nextStepPath} replace />
          ) : (
            <LoginPage onLoggedIn={handleAuth} notice={loginNotice} />
          )
        }
      />
      <Route
        path="/settings"
        element={
          accessToken ? (
            member(
              accessToken,
              <SettingsPage
                token={accessToken}
                userId={profile?.profile?.userId ?? profile?.profile?.user?.id ?? 'member'}
                onLogout={clearSession}
                onLoggedOutEverywhere={handleLoggedOutEverywhere}
                onDeletionScheduled={(purgeAt) => setDeletion({ purgeAt })}
              />,
            )
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
      <Route
        path="/register"
        element={
          accessToken ? (
            mayEdit ? (
              member(
                accessToken,
                <WizardPage token={accessToken} profile={profile} onProfileUpdate={setProfile} />,
              )
            ) : (
              <Navigate to={nextStepPath} replace />
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
            !mayEdit ? (
              <Navigate to={nextStepPath} replace />
            ) : !isProfileComplete ? (
              <Navigate to="/register" replace />
            ) : (
              member(
                accessToken,
                <KycPage
                  token={accessToken}
                  reviewStatus={reviewStatus}
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
        path="/pending"
        element={
          accessToken ? (
            reviewStatus === 'draft' || reviewStatus === 'approved' ? (
              <Navigate to={nextStepPath} replace />
            ) : (
              member(
                accessToken,
                <PendingPage
                  token={accessToken}
                  status={reviewStatus}
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
            reviewStatus === 'approved' ? (
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
      <Route
        path="/profile/:profileRef"
        element={
          accessToken ? (
            reviewStatus === 'approved' ? (
              member(accessToken, <ProfileDetailPage token={accessToken} onLogout={clearSession} />)
            ) : (
              <Navigate to={nextStepPath} replace />
            )
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
      <Route
        path="/interests"
        element={
          accessToken ? (
            reviewStatus === 'approved' ? (
              member(accessToken, <InterestsPage token={accessToken} onLogout={clearSession} />)
            ) : (
              <Navigate to={nextStepPath} replace />
            )
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
      <Route
        path="/shortlists"
        element={
          accessToken ? (
            reviewStatus === 'approved' ? (
              member(accessToken, <ShortlistsPage token={accessToken} onLogout={clearSession} />)
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
