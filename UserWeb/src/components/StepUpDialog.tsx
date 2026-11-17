import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { hasErrorCode } from '../apiError';
import { describeError, type FriendlyError } from '../errors/messages';
import { ErrorNotice } from './ErrorNotice';
import { Button } from './ui/button';
import { useDialogFocus } from './useDialogFocus';

interface StepUpDialogProps {
  title: string;
  confirmLabel: string;
  busyLabel: string;
  /** Statements shown above the password field. */
  children: ReactNode;
  /** Sends the request. Throws the ApiError on failure; resolves when it succeeded. */
  run: (password: string) => Promise<void>;
  onClose: () => void;
  /** The session is no longer valid. */
  onLogout: () => void;
}

/**
 * Modal that asks for the member's password again before a sensitive action.
 * The password lives in this component's state only while it is being typed; it
 * is cleared as soon as an attempt is sent and never stored or logged.
 */
export function StepUpDialog({
  title,
  confirmLabel,
  busyLabel,
  children,
  run,
  onClose,
  onLogout,
}: StepUpDialogProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const inFlight = useRef(false);
  const titleId = useId();
  const [password, setPassword] = useState('');
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<FriendlyError | null>(null);
  const onKeyDown = useDialogFocus(panelRef, onClose, busy);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (inFlight.current || password === '') return;
    const attempt = password;
    inFlight.current = true;
    setPassword('');
    setVisible(false);
    setError(null);
    setBusy(true);
    try {
      await run(attempt);
    } catch (err) {
      if (hasErrorCode(err, 'UNAUTHORIZED')) {
        onLogout();
        return;
      }
      setError(describeError(err, 'stepUp'));
      inFlight.current = false;
      setBusy(false);
    }
  }

  // The input is disabled while busy, so focus can only return after the re-render.
  useEffect(() => {
    if (!busy && error) inputRef.current?.focus();
  }, [busy, error]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        data-testid="stepup-dialog"
        onKeyDown={onKeyDown}
        className="max-h-[90vh] w-full max-w-sm overflow-y-auto rounded-2xl bg-white p-6 text-left shadow-soft focus:outline-none"
      >
        <form onSubmit={(event) => void submit(event)} className="space-y-4" noValidate>
          <h2 id={titleId} className="font-serif text-xl font-bold text-brand-charcoal">
            {title}
          </h2>
          <div className="space-y-2 text-sm text-brand-muted">{children}</div>
          <ErrorNotice error={error} testId="stepup-error" />
          <div>
            <label
              htmlFor="stepup-password"
              className="block text-xs font-semibold uppercase tracking-wider text-brand-muted"
            >
              Password
            </label>
            <div className="mt-1 flex items-center gap-2">
              <input
                ref={inputRef}
                id="stepup-password"
                data-testid="stepup-password"
                type={visible ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                disabled={busy}
                onChange={(event) => setPassword(event.target.value)}
                className="min-w-0 flex-1 rounded-xl border border-brand-border bg-brand-canvas px-4 py-3 text-sm text-brand-charcoal focus:border-brand-primary focus:outline-none"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                aria-label={visible ? 'Hide password' : 'Show password'}
                aria-pressed={visible}
                data-testid="stepup-toggle"
                disabled={busy}
                onClick={() => setVisible((current) => !current)}
              >
                {visible ? (
                  <EyeOff className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Eye className="h-4 w-4" aria-hidden="true" />
                )}
              </Button>
            </div>
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              data-testid="stepup-cancel"
              disabled={busy}
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              data-testid="stepup-submit"
              disabled={busy || password === ''}
            >
              {busy ? busyLabel : confirmLabel}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
