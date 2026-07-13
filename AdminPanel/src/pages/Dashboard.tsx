import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import type { DashboardStats, PendingProfile } from '../types';

interface DashboardProps {
  token: string;
  adminName: string;
  onLogout: () => void;
}

export function Dashboard({ token, adminName, onLogout }: DashboardProps) {
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
