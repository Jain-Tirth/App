import type { ProfileResponse } from '../types';
import { Card } from '../components/Card';
import { Logo } from '../components/Logo';

interface PendingPageProps {
  profile: ProfileResponse | null;
}

export function PendingPage({ profile }: PendingPageProps) {
  return (
    <div className="mx-auto flex min-h-screen max-w-lg items-center px-4 py-10">
      <Card className="w-full p-8 text-center sm:p-10">
        <div className="flex justify-center mb-6">
          <Logo variant="navbar" showTagline={false} />
        </div>

        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-brand-gold/15 text-brand-gold">
          <svg className="h-8 w-8 text-[#B89025]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>

        <h1 className="font-serif text-3xl font-bold text-brand-charcoal">Profile Under Review</h1>
        <p className="mt-3 text-sm leading-relaxed text-brand-muted">
          Your profile has been submitted successfully (completion: {profile?.completion.percentage ?? 0}%).
          Our administrative team is reviewing your details to ensure a 100% verified, trusted community.
        </p>

        {profile?.profile?.profileUid ? (
          <div className="mt-5 rounded-xl border border-brand-primary/20 bg-brand-primary-soft p-3 text-xs text-brand-primary font-semibold">
            Profile Reference UID: {profile.profile.profileUid}
          </div>
        ) : null}
      </Card>
    </div>
  );
}
