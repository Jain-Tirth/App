import { useRef, useState } from 'react';
import { api } from '../api';
import { hasErrorCode, isApiError } from '../apiError';
import { describeError, type FriendlyError } from '../errors/messages';
import { formatRetryDay } from '../lib/interests';
import { ErrorNotice } from './ErrorNotice';
import { Button } from './ui/button';

type SendState =
  | { kind: 'idle' }
  | { kind: 'busy' }
  | { kind: 'sent' }
  | { kind: 'cooldown'; day: string | null };

interface SendInterestButtonProps {
  token: string;
  receiverProfileRef: string;
  onLogout: () => void;
  size?: 'default' | 'sm';
}

/**
 * Sends one interest. Cards carry no interest state, so a repeat on a fresh
 * page is answered by the server and the button then settles on "Interest sent".
 */
export function SendInterestButton({
  token,
  receiverProfileRef,
  onLogout,
  size = 'sm',
}: SendInterestButtonProps) {
  const inFlight = useRef(false);
  const [state, setState] = useState<SendState>({ kind: 'idle' });
  const [error, setError] = useState<FriendlyError | null>(null);

  async function send() {
    if (inFlight.current) return;
    inFlight.current = true;
    setError(null);
    setState({ kind: 'busy' });
    try {
      await api.sendInterest(token, receiverProfileRef);
      setState({ kind: 'sent' });
    } catch (err) {
      if (hasErrorCode(err, 'UNAUTHORIZED')) {
        onLogout();
        return;
      }
      setError(describeError(err, 'interests'));
      if (hasErrorCode(err, 'INTEREST_ALREADY_EXISTS')) {
        setState({ kind: 'sent' });
      } else if (hasErrorCode(err, 'INTEREST_COOLDOWN')) {
        const details = isApiError(err) && isRecord(err.details) ? err.details : null;
        setState({ kind: 'cooldown', day: formatRetryDay(details?.retryAfter) });
      } else {
        setState({ kind: 'idle' });
      }
    } finally {
      inFlight.current = false;
    }
  }

  const label =
    state.kind === 'busy'
      ? 'Sending...'
      : state.kind === 'sent'
        ? 'Interest sent'
        : state.kind === 'cooldown'
          ? state.day
            ? `Available on ${state.day}`
            : 'Available later'
          : 'Send interest';

  return (
    <div className="min-w-0 space-y-2" data-testid="send-interest">
      <Button
        type="button"
        size={size}
        data-testid="send-interest-button"
        disabled={state.kind !== 'idle'}
        aria-busy={state.kind === 'busy'}
        onClick={() => void send()}
        className="max-w-full whitespace-normal"
      >
        {label}
      </Button>
      <div aria-live="polite">
        <ErrorNotice error={error} testId="send-interest-error" />
      </div>
    </div>
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
