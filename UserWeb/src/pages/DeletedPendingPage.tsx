import { useEffect, useRef, useState } from 'react';
import { api } from '../api';
import { hasErrorCode } from '../apiError';
import { decideCancelFailure } from '../lib/deletionCancel';
import { ErrorNotice } from '../components/ErrorNotice';
import { Logo } from '../components/Logo';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { describeError, type FriendlyError } from '../errors/messages';
import { formatPurgeDate } from '../lib/accountSettings';

interface DeletedPendingPageProps {
  token: string;
  /** ISO date the account is purged, from the server; null when the server did not say. */
  purgeAt: string | null;
  /** Deletion cancelled (or nothing to cancel): return to the normal app. */
  onCancelled: () => void;
  onLogout: () => void;
}

/** The only screen a member with a pending deletion sees. */
export function DeletedPendingPage({ token, purgeAt, onCancelled, onLogout }: DeletedPendingPageProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<FriendlyError | null>(null);
  const [purged, setPurged] = useState(false);
  const inFlight = useRef(false);
  const cancelRef = useRef<HTMLButtonElement>(null);

  // The button is disabled while busy; restore focus after the re-render.
  useEffect(() => {
    if (!busy && error) cancelRef.current?.focus();
  }, [busy, error]);

  async function cancel() {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      await api.cancelDeletion(token);
      onCancelled();
    } catch (err) {
      const action = decideCancelFailure(err);
      if (action === 'logout') {
        onLogout();
        return;
      }
      if (action === 'recheck') {
        // Nothing is pending any more; the app re-checks the account.
        onCancelled();
        return;
      }
      setPurged(hasErrorCode(err, 'ACCOUNT_PURGED'));
      setError(describeError(err, 'generic'));
      inFlight.current = false;
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-lg items-center px-4 py-10">
      <Card className="w-full space-y-5 p-6 sm:p-10">
        <Logo variant="navbar" showTagline={false} />
        <h1 className="font-serif text-2xl font-bold text-brand-charcoal sm:text-3xl">
          Your account is scheduled for deletion.
        </h1>
        <p data-testid="purge-date" className="text-sm text-brand-muted">
          It will be permanently deleted on {formatPurgeDate(purgeAt)}. Until then you can cancel
          the deletion and use your account again.
        </p>
        <ErrorNotice error={error} testId="deletion-error" />
        {purged ? (
          <a
            href="/"
            data-testid="purged-start-link"
            onClick={onLogout}
            className="block text-sm font-semibold text-brand-primary underline"
          >
            Go to the start page
          </a>
        ) : null}
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            ref={cancelRef}
            type="button"
            data-testid="cancel-deletion"
            disabled={busy}
            onClick={() => void cancel()}
          >
            {busy ? 'Cancelling...' : 'Cancel deletion'}
          </Button>
          <Button type="button" variant="outline" data-testid="deleted-logout" onClick={onLogout}>
            Log out
          </Button>
        </div>
      </Card>
    </div>
  );
}
