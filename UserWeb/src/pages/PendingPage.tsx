import { useEffect, useState } from 'react';
import type { ProfileResponse, ProfileReviewStatus } from '../types';
import { api } from '../api';
import { hasErrorCode } from '../apiError';
import { ErrorNotice } from '../components/ErrorNotice';
import { Logo } from '../components/Logo';
import { ReviewDecisionPanel } from '../components/ReviewDecisionPanel';
import { SubmitForReview } from '../components/SubmitForReview';
import { WithdrawDialog } from '../components/WithdrawDialog';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { describeError, type FriendlyError } from '../errors/messages';
import { decisionViewFor } from '../lib/reviewDecision';
import { allowedActions } from '../lib/profileStatus';
import { Clock, LogOut, ShieldCheck, Undo2 } from 'lucide-react';

interface PendingPageProps {
  token: string;
  status: ProfileReviewStatus;
  profile: ProfileResponse | null;
  onProfileUpdate: (profile: ProfileResponse) => void;
  onLogout: () => void;
}

const POLL_INTERVAL_MS = 4000;

export function PendingPage({ token, status, profile, onProfileUpdate, onLogout }: PendingPageProps) {
  const [withdrawing, setWithdrawing] = useState(false);
  const [checkError, setCheckError] = useState<FriendlyError | null>(null);
  const actions = allowedActions(status);
  const user = profile?.profile?.user;

  // Poll so a decision, an approval or a reopen shows without a manual reload.
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        onProfileUpdate(await api.getMyProfile(token));
      } catch (err) {
        // Background polling retries silently, except when the session has ended.
        if (hasErrorCode(err, 'UNAUTHORIZED')) {
          setCheckError(describeError(err, 'profile'));
          onLogout();
        }
      }
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [token, onProfileUpdate, onLogout]);

  async function refreshProfile() {
    onProfileUpdate(await api.getMyProfile(token));
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-xl items-center px-4 py-12">
      <Card
        data-testid="pending-state"
        data-state={status}
        className="w-full border-brand-border bg-white p-6 text-center shadow-soft sm:p-10"
      >
        <div className="mb-6 flex justify-center">
          <Logo variant="navbar" showTagline={false} />
        </div>

        {status === 'needsChanges' ? (
          <ReviewDecisionPanel
            view={decisionViewFor('needsChanges', user?.reviewDecision, user?.rejectionReason)}
            onLogout={onLogout}
          >
            {actions.submitAgain ? (
              <SubmitForReview token={token} label="Submit again" onSubmitted={refreshProfile} />
            ) : null}
          </ReviewDecisionPanel>
        ) : status === 'rejected' ? (
          <ReviewDecisionPanel
            view={decisionViewFor('rejected', user?.reviewDecision, user?.rejectionReason)}
            onLogout={onLogout}
          />
        ) : (
          <div className="space-y-6">
            <div className="relative mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-brand-primary-soft text-brand-primary">
              <Clock className="h-9 w-9 animate-pulse text-brand-primary" />
            </div>

            <div>
              <div className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">
                <ShieldCheck className="h-3.5 w-3.5 text-amber-600" />
                <span>Verification In Progress</span>
              </div>
              <h1 className="font-serif text-3xl font-bold text-brand-charcoal">Profile Under Review</h1>
              <p
                data-testid="pending-submitted-text"
                className="mt-2 text-sm leading-relaxed text-brand-muted"
              >
                Your profile is currently under review. It will be made live once it has been approved by an admin.
              </p>
            </div>

            <ErrorNotice error={checkError} testId="pending-error" />

            <div className="flex flex-col items-center justify-center gap-3 pt-2 sm:flex-row">
              {actions.withdraw ? (
                <Button
                  type="button"
                  variant="outline"
                  data-testid="withdraw-open"
                  onClick={() => setWithdrawing(true)}
                  className="w-full gap-2 sm:w-auto"
                >
                  <Undo2 className="h-4 w-4" />
                  <span>Withdraw from review</span>
                </Button>
              ) : null}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onLogout}
                className="w-full gap-2 text-brand-muted hover:text-brand-charcoal sm:w-auto"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>Sign Out</span>
              </Button>
            </div>
          </div>
        )}
      </Card>

      {withdrawing ? (
        <WithdrawDialog token={token} onClose={() => setWithdrawing(false)} onWithdrawn={refreshProfile} />
      ) : null}
    </div>
  );
}
