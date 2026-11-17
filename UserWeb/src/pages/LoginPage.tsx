import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import type { LoginResponse } from '../types';
import { Card } from '../components/Card';
import { ErrorNotice } from '../components/ErrorNotice';
import { Logo } from '../components/Logo';
import { describeError, type FriendlyError } from '../errors/messages';

interface LoginPageProps {
  onLoggedIn: (data: LoginResponse) => void;
  /** A one-off message shown above the form, for example after logging out everywhere. */
  notice?: string | null;
}

export function LoginPage({ onLoggedIn, notice = null }: LoginPageProps) {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<FriendlyError | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const response = await api.login(email, password);
      onLoggedIn(response);
      navigate('/app');
    } catch (err) {
      setError(describeError(err, 'login'));
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-lg items-center px-4 py-10">
      <Card className="w-full p-8 sm:p-10">
        <button onClick={() => navigate('/')} className="mb-6 block text-left">
          <Logo variant="navbar" showTagline={false} />
        </button>

        <h1 className="text-3xl font-serif font-bold text-brand-charcoal">Welcome back</h1>
        <p className="mt-1 text-sm text-brand-muted">
          Sign in to access verified Dhobi Matrimony profiles.
        </p>

        {notice ? (
          <p
            role="status"
            data-testid="login-notice"
            className="mt-4 rounded-xl border border-brand-border bg-brand-canvas p-3 text-sm text-brand-charcoal"
          >
            {notice}
          </p>
        ) : null}

        <form onSubmit={submit} className="mt-6 space-y-4">
          <div>
            <label htmlFor="login-email" className="block text-xs font-semibold uppercase tracking-wider text-brand-muted">
              Email Address
            </label>
            <input
              id="login-email"
              data-testid="login-email"
              className="mt-1 w-full rounded-xl border border-brand-border bg-brand-canvas px-4 py-3 text-sm text-brand-charcoal focus:border-brand-primary focus:outline-none"
              placeholder="name@example.com"
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>

          <div>
            <label htmlFor="login-password" className="block text-xs font-semibold uppercase tracking-wider text-brand-muted">
              Password
            </label>
            <input
              id="login-password"
              data-testid="login-password"
              className="mt-1 w-full rounded-xl border border-brand-border bg-brand-canvas px-4 py-3 text-sm text-brand-charcoal focus:border-brand-primary focus:outline-none"
              placeholder="••••••••"
              type="password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>

          <ErrorNotice error={error} testId="login-error" />

          <button
            type="submit"
            data-testid="login-submit"
            disabled={submitting}
            className="w-full rounded-xl bg-brand-primary px-5 py-3 text-sm font-semibold text-white shadow-button transition-all hover:bg-brand-primary-hover hover:scale-[1.01] disabled:pointer-events-none disabled:opacity-50"
          >
            {submitting ? 'Signing in...' : 'Sign In'}
          </button>

          <p className="mt-4 text-center text-sm text-brand-muted">
            Don&apos;t have an account?{' '}
            <button
              type="button"
              data-testid="login-to-signup"
              onClick={() => navigate('/signup')}
              className="font-semibold text-brand-primary hover:underline"
            >
              Register Free
            </button>
          </p>
        </form>
      </Card>
    </div>
  );
}
