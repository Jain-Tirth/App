import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import type { LoginResponse } from '../types';
import { Card } from '../components/Card';
import { Logo } from '../components/Logo';

interface LoginPageProps {
  onLoggedIn: (data: LoginResponse) => void;
}

export function LoginPage({ onLoggedIn }: LoginPageProps) {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    try {
      const response = await api.login(email, password);
      onLoggedIn(response);
      navigate('/app');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
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

        <form onSubmit={submit} className="mt-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-brand-muted">
              Email Address
            </label>
            <input
              className="mt-1 w-full rounded-xl border border-brand-border bg-brand-canvas px-4 py-3 text-sm text-brand-charcoal focus:border-brand-primary focus:outline-none"
              placeholder="name@example.com"
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-brand-muted">
              Password
            </label>
            <input
              className="mt-1 w-full rounded-xl border border-brand-border bg-brand-canvas px-4 py-3 text-sm text-brand-charcoal focus:border-brand-primary focus:outline-none"
              placeholder="••••••••"
              type="password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>

          {error ? <p className="text-sm font-medium text-red-600">{error}</p> : null}

          <button
            type="submit"
            className="w-full rounded-xl bg-brand-primary px-5 py-3 text-sm font-semibold text-white shadow-button transition-all hover:bg-brand-primary-hover hover:scale-[1.01]"
          >
            Sign In
          </button>

          <p className="mt-4 text-center text-sm text-brand-muted">
            Don&apos;t have an account?{' '}
            <button
              type="button"
              onClick={() => navigate('/register')}
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
