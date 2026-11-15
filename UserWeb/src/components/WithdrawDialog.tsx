import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { api } from '../api';
import { describeError, type FriendlyError } from '../errors/messages';
import { ErrorNotice } from './ErrorNotice';
import { Button } from './ui/button';

interface WithdrawDialogProps {
  token: string;
  onClose: () => void;
  /** Runs after the server accepted the withdrawal (refresh the profile, move on). */
  onWithdrawn: () => Promise<void>;
}

/** Confirmation before a submitted profile is taken out of review. */
export function WithdrawDialog({ token, onClose, onWithdrawn }: WithdrawDialogProps) {
  const keepRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const inFlight = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<FriendlyError | null>(null);

  useEffect(() => {
    const trigger = document.activeElement;
    keepRef.current?.focus();
    return () => {
      if (trigger instanceof HTMLElement) trigger.focus();
    };
  }, []);

  async function withdraw() {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      await api.withdrawProfile(token);
      await onWithdrawn();
    } catch (err) {
      setError(describeError(err, 'withdraw'));
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape' && !busy) {
      event.stopPropagation();
      onClose();
      return;
    }
    if (event.key !== 'Tab') return;
    const first = keepRef.current;
    const last = confirmRef.current;
    if (!first || !last) return;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="withdraw-title"
        aria-describedby="withdraw-body"
        data-testid="withdraw-dialog"
        onKeyDown={onKeyDown}
        className="w-full max-w-sm space-y-4 rounded-2xl bg-white p-6 text-left shadow-soft"
      >
        <h2 id="withdraw-title" className="font-serif text-xl font-bold text-brand-charcoal">
          Withdraw your profile from review?
        </h2>
        <p id="withdraw-body" className="text-sm text-brand-muted">
          Your profile goes back to draft and all your details are kept. You can edit it and submit again.
        </p>
        <ErrorNotice error={error} testId="withdraw-error" />
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            ref={keepRef}
            type="button"
            variant="outline"
            data-testid="withdraw-cancel"
            disabled={busy}
            onClick={onClose}
          >
            Keep in review
          </Button>
          <Button
            ref={confirmRef}
            type="button"
            data-testid="withdraw-confirm"
            disabled={busy}
            onClick={() => void withdraw()}
          >
            {busy ? 'Withdrawing...' : 'Withdraw'}
          </Button>
        </div>
      </div>
    </div>
  );
}
