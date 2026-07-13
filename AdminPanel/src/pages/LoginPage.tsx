import { useState, type FormEvent } from 'react';
import { api } from '../api';

interface LoginPageProps {
  onLogin: (token: string, name: string) => void;
}

export function LoginPage({ onLogin }: LoginPageProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await api.login(email, password);
      onLogin(response.accessToken, response.admin.name);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-[2rem] border border-brand-gold/40 bg-white/90 p-8 shadow-soft backdrop-blur"
      >
        <p className="text-sm uppercase tracking-[0.35em] text-brand-maroon/70">
          Admin Panel
        </p>
        <h1 className="mt-3 text-4xl font-semibold text-brand-ink">
          Review Profiles
        </h1>
        <p className="mt-3 text-sm text-brand-ink/70">
          Sign in with an admin account to review pending approvals.
        </p>
        <div className="mt-8 space-y-4">
          <input
            className="w-full rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 outline-none focus:border-brand-maroon"
            placeholder="Admin email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <input
            className="w-full rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 outline-none focus:border-brand-maroon"
            placeholder="Password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </div>
        {error ? <p className="mt-4 text-sm text-red-700">{error}</p> : null}
        <button
          type="submit"
          disabled={loading}
          className="mt-6 w-full rounded-2xl bg-brand-maroon px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
        >
          {loading ? 'Signing in...' : 'Sign In'}
        </button>
      </form>
    </div>
  );
}
