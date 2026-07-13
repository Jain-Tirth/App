import { Navigate, Route, Routes, useNavigate, useParams } from 'react-router-dom';
import { useEffect, useState, type FormEvent } from 'react';
import { api } from './api';
import type { DashboardStats, PendingProfile, ReviewProfileResponse } from './types';

function LoginPage({
  onLogin,
}: {
  onLogin: (token: string, name: string) => void;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await api.login(email, password);
      onLogin(response.accessToken, response.admin.name);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-[2rem] border border-brand-gold/40 bg-white/90 p-8 shadow-soft backdrop-blur"
      >
        <p className="text-sm uppercase tracking-[0.35em] text-brand-maroon/70">
          Admin Panel
        </p>
        <h1 className="mt-3 text-4xl font-semibold text-brand-ink">
          Review Profiles
        </h1>
        <p className="mt-3 text-sm text-brand-ink/70">
          Sign in with an admin account to review pending approvals.
        </p>
        <div className="mt-8 space-y-4">
          <input
            className="w-full rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 outline-none focus:border-brand-maroon"
            placeholder="Admin email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <input
            className="w-full rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 outline-none focus:border-brand-maroon"
            placeholder="Password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </div>
        {error ? <p className="mt-4 text-sm text-red-700">{error}</p> : null}
        <button
          type="submit"
          disabled={loading}
          className="mt-6 w-full rounded-2xl bg-brand-maroon px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
        >
          {loading ? 'Signing in...' : 'Sign In'}
        </button>
      </form>
    </div>
  );
}

function Dashboard({
  token,
  adminName,
  onLogout,
}: {
  token: string;
  adminName: string;
  onLogout: () => void;
}) {
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [profiles, setProfiles] = useState<PendingProfile[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const [statsResponse, profilesResponse] = await Promise.all([
          api.getStats(token),
          api.getPendingProfiles(token),
        ]);
        setStats(statsResponse);
        setProfiles(profilesResponse.profiles);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load dashboard');
      }
    }

    void load();
  }, [token]);

  const statCards = [
    ['Pending', stats?.pendingProfiles ?? 0],
    ['Approved', stats?.approvedProfiles ?? 0],
    ['Rejected', stats?.rejectedProfiles ?? 0],
    ['Total', stats?.totalProfiles ?? 0],
  ];

  return (
    <div className="min-h-screen px-4 py-6 md:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="rounded-[2rem] bg-brand-maroon px-6 py-6 text-white shadow-soft">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.35em] text-brand-gold">
                Dhobi Matrimony
              </p>
              <h1 className="mt-2 text-3xl font-semibold">Admin Dashboard</h1>
              <p className="mt-2 text-sm text-white/75">
                Signed in as {adminName}
              </p>
            </div>
            <button
              onClick={onLogout}
              className="rounded-full border border-white/30 px-5 py-2 text-sm"
            >
              Logout
            </button>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-4">
          {statCards.map(([label, value]) => (
            <div
              key={label}
              className="rounded-[1.5rem] border border-brand-gold/30 bg-white p-5 shadow-soft"
            >
              <p className="text-xs uppercase tracking-[0.3em] text-brand-maroon/70">
                {label}
              </p>
              <p className="mt-3 text-4xl font-semibold text-brand-ink">{value}</p>
            </div>
          ))}
        </div>

        <div className="mt-6 rounded-[2rem] border border-stone-200 bg-white p-6 shadow-soft">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-brand-ink">
                Pending Profiles
              </h2>
              <p className="mt-1 text-sm text-brand-ink/70">
                Review new registrations awaiting approval.
              </p>
            </div>
          </div>
          {error ? <p className="mt-4 text-sm text-red-700">{error}</p> : null}
          <div className="mt-6 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-brand-ink/60">
                <tr>
                  <th className="pb-3">Name</th>
                  <th className="pb-3">Profile ID</th>
                  <th className="pb-3">Gender</th>
                  <th className="pb-3">Created By</th>
                  <th className="pb-3">Complete</th>
                  <th className="pb-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {profiles.map((profile) => (
                  <tr key={profile.userId} className="border-t border-stone-100">
                    <td className="py-4">
                      <div className="font-semibold">{profile.name}</div>
                      <div className="text-brand-ink/60">{profile.email}</div>
                    </td>
                    <td className="py-4">{profile.profileUid ?? 'Pending'}</td>
                    <td className="py-4 capitalize">{profile.gender ?? '-'}</td>
                    <td className="py-4 capitalize">
                      {profile.profileCreatedBy ?? '-'}
                    </td>
                    <td className="py-4">{profile.profileComplete}%</td>
                    <td className="py-4">
                      <button
                        onClick={() => navigate(`/profiles/${profile.userId}`)}
                        className="rounded-full bg-brand-maroon px-4 py-2 text-white"
                      >
                        Review
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {profiles.length === 0 ? (
              <p className="py-8 text-center text-brand-ink/60">
                No pending profiles right now.
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function ReviewPage({ token }: { token: string }) {
  const navigate = useNavigate();
  const { userId = '' } = useParams();
  const [data, setData] = useState<ReviewProfileResponse | null>(null);
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const response = await api.getProfile(token, userId);
        setData(response);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load profile');
      }
    }

    void load();
  }, [token, userId]);

  async function approve() {
    await api.approveProfile(token, userId);
    navigate('/');
  }

  async function reject() {
    if (!reason.trim()) {
      setError('Rejection reason is required.');
      return;
    }

    await api.rejectProfile(token, userId, reason);
    navigate('/');
  }

  const sections = data
    ? [
        ['Personal', data.profile.personalDetails],
        ['Religious', data.profile.religiousDetails],
        ['Location', data.profile.locationDetails],
        ['Professional', data.profile.professionalDetails],
        ['Additional', data.profile.additionalDetails],
        ['Verification', data.profile.verificationFlags],
      ]
    : [];

  return (
    <div className="min-h-screen px-4 py-6 md:px-8">
      <div className="mx-auto max-w-5xl rounded-[2rem] border border-stone-200 bg-white p-6 shadow-soft">
        <button
          onClick={() => navigate('/')}
          className="rounded-full border border-stone-200 px-4 py-2 text-sm"
        >
          Back
        </button>
        {error ? <p className="mt-4 text-sm text-red-700">{error}</p> : null}
        {data ? (
          <>
            <div className="mt-6 flex flex-col gap-3">
              <p className="text-sm uppercase tracking-[0.3em] text-brand-maroon/70">
                Review Profile
              </p>
              <h1 className="text-3xl font-semibold text-brand-ink">
                {data.profile.user.name}
              </h1>
              <p className="text-brand-ink/70">
                {data.profile.profileUid ?? 'Pending ID'} |{' '}
                {data.profile.profileComplete}% complete
              </p>
            </div>
            <div className="mt-8 grid gap-5 md:grid-cols-2">
              {sections.map(([title, values]) => (
                <div
                  key={title}
                  className="rounded-[1.5rem] border border-stone-100 bg-stone-50 p-5"
                >
                  <h2 className="text-lg font-semibold text-brand-ink">{title}</h2>
                  <div className="mt-4 space-y-2 text-sm">
                    {Object.entries(values).map(([key, value]) => (
                      <div key={key} className="flex justify-between gap-4">
                        <span className="capitalize text-brand-ink/60">
                          {key.replace(/([A-Z])/g, ' $1')}
                        </span>
                        <span className="text-right text-brand-ink">
                          {Array.isArray(value)
                            ? value.join(', ') || '-'
                            : String(value ?? '-')}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-8 rounded-[1.5rem] border border-brand-gold/40 bg-brand-sand p-5">
              <label className="block text-sm font-semibold text-brand-ink">
                Rejection reason
              </label>
              <textarea
                className="mt-3 min-h-28 w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 outline-none focus:border-brand-maroon"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Explain why this profile is being rejected"
              />
              <div className="mt-4 flex flex-col gap-3 md:flex-row">
                <button
                  onClick={() => void approve()}
                  className="rounded-2xl bg-emerald-700 px-5 py-3 text-white"
                >
                  Approve
                </button>
                <button
                  onClick={() => void reject()}
                  className="rounded-2xl bg-brand-maroon px-5 py-3 text-white"
                >
                  Reject
                </button>
              </div>
            </div>
          </>
        ) : (
          <p className="mt-8 text-brand-ink/60">Loading profile...</p>
        )}
      </div>
    </div>
  );
}

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
