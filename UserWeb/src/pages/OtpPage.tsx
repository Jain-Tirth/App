import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { api } from '../api';
import type { LoginResponse, RegisterResponse } from '../types';
import { Card } from '../components/Card';

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

  if (!otpContext) {
    return <Navigate to="/register" replace />;
  }

  // otpContext is guaranteed non-null below this point.
  // We capture it into a local const so inner async functions
  // can access it without TypeScript complaining.
  const ctx = otpContext;

  async function verify(event: FormEvent) {
    event.preventDefault();
    setError('');
    try {
      const response = await api.verifyOtp(
        ctx.countryCode,
        ctx.mobileNumber,
        otpCode,
      );
      onVerified(response);
      navigate('/wizard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'OTP verification failed');
    }
  }

  async function resend() {
    try {
      const response = await api.resendOtp(
        ctx.countryCode,
        ctx.mobileNumber,
      );
      setHint(response.otpCode ?? '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to resend OTP');
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-3xl items-center px-4 py-10">
      <Card className="w-full">
        <p className="text-sm uppercase tracking-[0.3em] text-brand-maroon/70">Screen 4</p>
        <h1 className="mt-3 text-4xl font-semibold text-brand-ink">Verify OTP</h1>
        <p className="mt-4 text-brand-ink/70">
          Please enter the 4-digit code sent to {ctx.countryCode} {ctx.mobileNumber}
        </p>
        {hint ? (
          <p className="mt-2 text-sm text-brand-maroon">
            Dev OTP: <strong>{hint}</strong>
          </p>
        ) : null}
        <form onSubmit={verify} className="mt-8">
          <input
            className="w-full rounded-2xl border border-stone-200 bg-stone-50 px-4 py-4 text-center text-2xl tracking-[0.6em]"
            value={otpCode}
            maxLength={4}
            onChange={(event) => setOtpCode(event.target.value)}
          />
          {error ? <p className="mt-4 text-sm text-red-700">{error}</p> : null}
          <button className="mt-6 w-full rounded-2xl bg-brand-maroon px-5 py-3 text-sm font-semibold text-white">
            Submit
          </button>
        </form>
        <button onClick={() => void resend()} className="mt-4 text-sm font-semibold text-brand-maroon">
          Resend OTP
        </button>
      </Card>
    </div>
  );
}
