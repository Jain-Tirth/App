import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { api } from '../api';
import type { LoginResponse, RegisterResponse } from '../types';
import { Card } from '../components/Card';
import { Logo } from '../components/Logo';

interface OtpContext {
  countryCode: string;
  mobileNumber: string;
  email: string;
  password: string;
  response: RegisterResponse;
}

interface OtpPageProps {
  otpContext: OtpContext | null;
  onVerified: (data: LoginResponse) => void;
}

export function OtpPage({ otpContext, onVerified }: OtpPageProps) {
  const navigate = useNavigate();
  const [otpCode, setOtpCode] = useState('');
  const [error, setError] = useState('');
  const [hint, setHint] = useState(otpContext?.response.otpCode ?? '');
  const [token, setToken] = useState(otpContext?.response.otpToken ?? '');
  const [loading, setLoading] = useState(false);

  if (!otpContext) {
    return <Navigate to="/register" replace />;
  }

  const ctx = otpContext;

  async function verify(event: FormEvent) {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      const response = await api.verifyOtp(
        ctx.countryCode,
        ctx.mobileNumber,
        otpCode,
        token || undefined,
      );
      onVerified(response);
      navigate('/wizard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'OTP verification failed');
    } finally {
      setLoading(false);
    }
  }

  async function resend() {
    setError('');
    try {
      const response = await api.resendOtp(
        ctx.countryCode,
        ctx.mobileNumber,
      );
      setHint(response.otpCode ?? '');
      if (response.otpToken) {
        setToken(response.otpToken);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to resend OTP');
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
          <div className="mt-4 rounded-xl border border-brand-primary/20 bg-brand-primary-soft p-3 text-xs text-brand-primary">
            Verification Code (Development): <strong className="text-sm tracking-wider">{hint}</strong>
          </div>
        ) : null}

        <form onSubmit={verify} className="mt-6">
          <input
            className="w-full rounded-2xl border border-brand-border bg-brand-canvas px-4 py-4 text-center font-mono text-3xl font-bold tracking-[0.5em] text-brand-charcoal focus:border-brand-primary focus:outline-none"
            value={otpCode}
            maxLength={4}
            autoFocus
            placeholder="••••"
            onChange={(event) => setOtpCode(event.target.value.replace(/\D/g, ''))}
          />

          {error ? <p className="mt-3 text-center text-sm font-medium text-red-600">{error}</p> : null}

          <button
            type="submit"
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
