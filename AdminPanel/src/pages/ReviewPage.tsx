import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';
import type { ReviewProfileResponse } from '../types';

interface ReviewPageProps {
  token: string;
}

export function ReviewPage({ token }: ReviewPageProps) {
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

  const sections: [string, Record<string, unknown>][] = data
    ? [
        ['Personal', data.profile.personalDetails as Record<string, unknown>],
        ['Religious', data.profile.religiousDetails as Record<string, unknown>],
        ['Location', data.profile.locationDetails as Record<string, unknown>],
        ['Professional', data.profile.professionalDetails as Record<string, unknown>],
        ['Additional', data.profile.additionalDetails as Record<string, unknown>],
        ['Verification', data.profile.verificationFlags as Record<string, unknown>],
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
