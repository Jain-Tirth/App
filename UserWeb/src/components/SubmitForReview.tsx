import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Send } from 'lucide-react';
import { api } from '../api';
import { isApiError } from '../apiError';
import { describeError, type FriendlyError } from '../errors/messages';
import { missingItemLabel, missingItemTarget, readMissingItems } from '../lib/profileStatus';
import { ErrorNotice } from './ErrorNotice';
import { Button } from './ui/button';

interface SubmitForReviewProps {
  token: string;
  label: 'Submit for review' | 'Submit again';
  /** Runs after the server accepted the submission (refresh the profile, move on). */
  onSubmitted: () => Promise<void>;
}

/** The submit action: one request per click, with the missing items listed in plain words. */
export function SubmitForReview({ token, label, onSubmitted }: SubmitForReviewProps) {
  const inFlight = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<FriendlyError | null>(null);
  const [missing, setMissing] = useState<string[]>([]);

  async function submit() {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    setMissing([]);
    try {
      await api.submitProfile(token);
      await onSubmitted();
    } catch (err) {
      setError(describeError(err, 'submit'));
      setMissing(isApiError(err) && err.code === 'SUBMISSION_INCOMPLETE' ? readMissingItems(err.details) : []);
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3 text-left" data-testid="submit-for-review">
      <ErrorNotice error={error} testId="submit-error" />
      {missing.length > 0 ? (
        <div data-testid="submit-missing">
          <p className="text-xs font-semibold uppercase tracking-wider text-brand-muted">Still needed</p>
          <ul className="mt-2 space-y-2">
            {missing.map((item) => (
              <li key={item}>
                <Link
                  to={missingItemTarget(item)}
                  data-testid={`submit-missing-${item}`}
                  className="block rounded-xl border border-brand-border bg-white px-4 py-3 text-sm font-semibold text-brand-primary hover:bg-brand-primary-soft"
                >
                  {missingItemLabel(item)}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <Button
        type="button"
        data-testid="submit-for-review-button"
        disabled={busy}
        onClick={() => void submit()}
        className="w-full gap-2"
      >
        <Send className="h-4 w-4" />
        <span>{busy ? 'Submitting...' : label}</span>
      </Button>
    </div>
  );
}
