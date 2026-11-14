import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { api } from '../api';
import type { LoginResponse } from '../types';
import { Card } from '../components/Card';
import { ErrorNotice } from '../components/ErrorNotice';
import { Logo } from '../components/Logo';
import { describeError, type FriendlyError } from '../errors/messages';
import type { OtpContext } from './SignupPage';

interface OtpPageProps {
  otpContext: OtpContext | null;
  onVerified: (data: LoginResponse) => void;
}

export function OtpPage({ otpContext, onVerified }: OtpPageProps) {
  const navigate = useNavigate();
  const [otpCode, setOtpCode] = useState('');
  const [error, setError] = useState<FriendlyError | null>(null);
  const [notice, setNotice] = useState('');
  // Outside production the API echoes the code; it is shown to ease testing.
  const [hint, setHint] = useState(otpContext?.response.otpCode ?? '');
  const [token, setToken] = useState(otpContext?.response.otpToken ?? '');
  const [loading, setLoading] = useState(false);

  if (!otpContext) {
    return <Navigate to="/signup" replace />;
  }

  const ctx = otpContext;

  async function verify(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setNotice('');
    setLoading(true);
    try {
      const response = await api.verifyOtp(
        ctx.countryCode,
        ctx.mobileNumber,
        otpCode,
        token || undefined,
      );
      onVerified(response);
      navigate('/register');
    } catch (err) {
      setError(describeError(err, 'otpVerify'));
      setLoading(false);
    }
  }

  async function resend() {
    setError(null);
    setNotice('');
    try {
      const response = await api.resendOtp(ctx.countryCode, ctx.mobileNumber);
      setHint(response.otpCode ?? '');
      if (response.otpToken) {
        setToken(response.otpToken);
      }
      setNotice('We have sent you a new code.');
    } catch (err) {
      setError(describeError(err, 'otpSend'));
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-lg items-center px-4 py-10">
      <Card className="w-full p-8 sm:p-10">
        <button onClick={() => navigate('/')} className="mb-6 block text-left">
          <Logo variant="navbar" showTagline={false} />
        </button>

        <h1 className="text-3xl font-serif font-bold text-brand-charcoal">Verify Mobile Number</h1>
        <p className="mt-2 text-sm text-brand-muted">
          Please enter the 4-digit verification code sent to{' '}
          <span className="font-semibold text-brand-charcoal">
            {ctx.countryCode} {ctx.mobileNumber}
          </span>
        </p>

        {hint ? (
          <div
            data-testid="otp-dev-hint"
            className="mt-4 rounded-xl border border-brand-primary/20 bg-brand-primary-soft p-3 text-xs text-brand-primary"
          >
            Verification Code (Development):{' '}
            <strong data-testid="otp-dev-code" className="text-sm tracking-wider">
              {hint}
            </strong>
          </div>
        ) : null}

        <form onSubmit={verify} className="mt-6">
          <input
            data-testid="otp-input"
            aria-label="Verification code"
            className="w-full rounded-2xl border border-brand-border bg-brand-canvas px-4 py-4 text-center font-mono text-3xl font-bold tracking-[0.5em] text-brand-charcoal focus:border-brand-primary focus:outline-none"
            value={otpCode}
            maxLength={4}
            inputMode="numeric"
            autoFocus
            placeholder="••••"
            onChange={(event) => setOtpCode(event.target.value.replace(/\D/g, ''))}
          />

          <ErrorNotice error={error} testId="otp-error" className="mt-3" />
          {notice ? (
            <p data-testid="otp-notice" className="mt-3 text-center text-sm text-emerald-700">
              {notice}
            </p>
          ) : null}

          <button
            type="submit"
            data-testid="otp-submit"
            disabled={loading || otpCode.length !== 4}
            className="mt-6 w-full rounded-xl bg-brand-primary px-5 py-3.5 text-sm font-semibold text-white shadow-button transition-all hover:bg-brand-primary-hover hover:scale-[1.01] disabled:opacity-50 disabled:pointer-events-none"
          >
            {loading ? 'Verifying...' : 'Verify & Continue'}
          </button>
        </form>

        <div className="mt-6 flex items-center justify-between text-xs text-brand-muted">
          <span>Didn&apos;t receive code?</span>
          <button
            type="button"
            data-testid="otp-resend"
            onClick={() => void resend()}
            className="font-semibold text-brand-primary hover:underline"
          >
            Resend OTP
          </button>
        </div>
      </Card>
    </div>
  );
}
