import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { api } from '../api';
import { describeReopenError } from '../errors/messages';
import { REASON_CODES, type ReasonCode } from '../types';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';

const NOTES_MAX = 500;
const selectClass =
  'w-full rounded-md border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm text-white';

interface ReopenDialogProps {
  token: string;
  userId: string;
  onClose: () => void;
  onReopened: () => void;
}

/** Reason code and notes for reopening a rejected profile. */
export function ReopenDialog({ token, userId, onClose, onReopened }: ReopenDialogProps) {
  const reasonRef = useRef<HTMLSelectElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const inFlight = useRef(false);
  const [reasonCode, setReasonCode] = useState<ReasonCode | ''>('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const trigger = document.activeElement;
    reasonRef.current?.focus();
    return () => {
      if (trigger instanceof HTMLElement) trigger.focus();
    };
  }, []);

  async function confirm() {
    if (reasonCode === '' || inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError('');
    try {
      await api.reopenProfile(token, userId, {
        reasonCode,
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      });
      onReopened();
    } catch (err) {
      setError(describeReopenError(err));
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
    const first = reasonRef.current;
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
        aria-labelledby="reopen-title"
        data-testid="reopen-dialog"
        onKeyDown={onKeyDown}
        className="w-full max-w-md space-y-4 rounded-lg border border-neutral-800 bg-neutral-950 p-6 text-white"
      >
        <h2 id="reopen-title" className="text-lg font-semibold">
          Reopen this profile?
        </h2>
        <p className="text-xs text-neutral-400">
          The member can then edit and submit the profile again.
        </p>

        {error ? (
          <p role="alert" data-testid="reopen-error" className="rounded-md border border-neutral-700 bg-neutral-900 p-3 text-xs">
            {error}
          </p>
        ) : null}

        <label className="block space-y-1.5 text-xs uppercase tracking-wider text-neutral-400">
          Reason code
          <select
            ref={reasonRef}
            data-testid="reopen-reason"
            className={selectClass}
            value={reasonCode}
            onChange={(event) => setReasonCode(event.target.value as ReasonCode | '')}
          >
            <option value="">Select a reason…</option>
            {REASON_CODES.map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </select>
        </label>

        <label className="block space-y-1.5 text-xs uppercase tracking-wider text-neutral-400">
          Notes
          <Textarea
            data-testid="reopen-notes"
            value={notes}
            maxLength={NOTES_MAX}
            rows={3}
            onChange={(event) => setNotes(event.target.value)}
          />
        </label>
        <p data-testid="reopen-remaining" className="text-xs text-neutral-300">
          {NOTES_MAX - notes.length} characters remaining
        </p>

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            data-testid="reopen-cancel"
            disabled={busy}
            onClick={onClose}
            className="border-neutral-700"
          >
            Cancel
          </Button>
          <Button
            ref={confirmRef}
            type="button"
            data-testid="reopen-confirm"
            disabled={busy || reasonCode === ''}
            onClick={() => void confirm()}
          >
            Confirm reopen
          </Button>
        </div>
      </div>
    </div>
  );
}
