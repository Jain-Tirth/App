import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { api } from '../api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { describeClearCooldownError } from '../errors/messages';
import { COOLDOWN_REASON_CODES, type CooldownReasonCode } from '../types';

const NOTES_MAX = 500;
const SUCCESS_MESSAGE = 'Cooldown cleared. The sender can send an interest again.';
const selectClass =
  'w-full rounded-md border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm text-white';

interface ConfirmProps {
  busy: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

/** Confirmation before the cooldown is lifted. Focus returns to the trigger on close. */
function ConfirmClear({ busy, onConfirm, onClose }: ConfirmProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const trigger = document.activeElement;
    cancelRef.current?.focus();
    return () => {
      if (trigger instanceof HTMLElement) trigger.focus();
    };
  }, []);

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape' && !busy) {
      event.stopPropagation();
      onClose();
      return;
    }
    if (event.key !== 'Tab') return;
    const first = cancelRef.current;
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="cooldown-confirm-title"
        data-testid="cooldown-dialog"
        onKeyDown={onKeyDown}
        className="w-full max-w-md space-y-4 rounded-lg border border-neutral-800 bg-neutral-950 p-6 text-white"
      >
        <h2 id="cooldown-confirm-title" className="text-lg font-semibold">
          Clear the resend cooldown for this pair?
        </h2>
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button
            ref={cancelRef}
            type="button"
            variant="outline"
            data-testid="cooldown-cancel"
            disabled={busy}
            onClick={onClose}
            className="border-neutral-700"
          >
            Cancel
          </Button>
          <Button
            ref={confirmRef}
            type="button"
            data-testid="cooldown-confirm"
            disabled={busy}
            onClick={onConfirm}
          >
            {busy ? 'Clearing...' : 'Yes, clear cooldown'}
          </Button>
        </div>
      </div>
    </div>
  );
}

interface InterestCooldownPageProps {
  token: string;
}

export function InterestCooldownPage({ token }: InterestCooldownPageProps) {
  const inFlight = useRef(false);
  const [senderProfileUid, setSender] = useState('');
  const [receiverProfileRef, setReceiver] = useState('');
  const [reasonCode, setReasonCode] = useState<CooldownReasonCode | ''>('');
  const [notes, setNotes] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const ready =
    senderProfileUid.trim() !== '' && receiverProfileRef.trim() !== '' && reasonCode !== '';

  async function clear() {
    if (reasonCode === '' || inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      await api.clearInterestCooldown(token, {
        senderProfileUid: senderProfileUid.trim(),
        receiverProfileRef: receiverProfileRef.trim(),
        reasonCode,
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      });
      setSuccess(SUCCESS_MESSAGE);
    } catch (err) {
      setError(describeClearCooldownError(err));
    } finally {
      inFlight.current = false;
      setBusy(false);
      setConfirming(false);
    }
  }

  return (
    <div className="min-h-screen bg-black px-4 py-8 text-white md:px-10">
      <main className="mx-auto max-w-xl space-y-6">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-sm text-neutral-300 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to dashboard
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Interest cooldown</h1>
        <p className="text-sm text-neutral-300">
          Lift the resend cooldown after a declined interest so the sender can try again.
        </p>

        {error ? (
          <p
            role="alert"
            data-testid="cooldown-error"
            className="rounded-md border border-neutral-700 bg-neutral-900 p-3 text-sm"
          >
            {error}
          </p>
        ) : null}
        {success ? (
          <p
            role="status"
            data-testid="cooldown-success"
            className="rounded-md border border-neutral-700 bg-neutral-900 p-3 text-sm"
          >
            {success}
          </p>
        ) : null}

        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (ready) setConfirming(true);
          }}
        >
          <label className="block space-y-1.5 text-sm text-neutral-300">
            Sender profile ID
            <Input
              data-testid="cooldown-sender"
              value={senderProfileUid}
              maxLength={32}
              autoComplete="off"
              onChange={(event) => setSender(event.target.value)}
            />
          </label>
          <label className="block space-y-1.5 text-sm text-neutral-300">
            Receiver profile ID
            <Input
              data-testid="cooldown-receiver"
              value={receiverProfileRef}
              maxLength={64}
              autoComplete="off"
              onChange={(event) => setReceiver(event.target.value)}
            />
          </label>
          <label className="block space-y-1.5 text-sm text-neutral-300">
            Reason code
            <select
              data-testid="cooldown-reason"
              className={selectClass}
              value={reasonCode}
              onChange={(event) => setReasonCode(event.target.value as CooldownReasonCode | '')}
            >
              <option value="">Select a reason...</option>
              {COOLDOWN_REASON_CODES.map((code) => (
                <option key={code} value={code}>
                  {code}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1.5 text-sm text-neutral-300">
            Notes
            <Textarea
              data-testid="cooldown-notes"
              value={notes}
              maxLength={NOTES_MAX}
              rows={3}
              onChange={(event) => setNotes(event.target.value)}
            />
          </label>
          <p data-testid="cooldown-remaining" className="text-xs text-neutral-300">
            {NOTES_MAX - notes.length} characters remaining
          </p>
          <Button type="submit" data-testid="cooldown-clear" disabled={!ready || busy}>
            Clear cooldown
          </Button>
        </form>
      </main>

      {confirming ? (
        <ConfirmClear busy={busy} onConfirm={() => void clear()} onClose={() => setConfirming(false)} />
      ) : null}
    </div>
  );
}
