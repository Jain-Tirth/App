import type { ProfileResponse } from '../types';
import { Card } from '../components/Card';

interface PendingPageProps {
  profile: ProfileResponse | null;
  onLogout: () => void;
}

export function PendingPage({ profile, onLogout }: PendingPageProps) {
  return (
    <div className="mx-auto flex min-h-screen max-w-4xl items-center px-4 py-10">
      <Card className="w-full text-center">
        <p className="text-sm uppercase tracking-[0.3em] text-brand-maroon/70">Pending Approval</p>
        <h1 className="mt-4 text-4xl font-semibold text-brand-ink">Your profile is under review</h1>
        <p className="mt-4 text-brand-ink/70">
          Profile completion: {profile?.completion.percentage ?? 0}%.
          Once an admin approves your account, you can continue into the main matching experience.
        </p>
        {profile?.profile?.profileUid ? (
          <p className="mt-3 text-sm text-brand-maroon">Profile ID: {profile.profile.profileUid}</p>
        ) : null}
        <button onClick={onLogout} className="mt-8 rounded-2xl border border-brand-maroon px-5 py-3 text-sm font-semibold text-brand-maroon">
          Logout
        </button>
      </Card>
    </div>
  );
}
