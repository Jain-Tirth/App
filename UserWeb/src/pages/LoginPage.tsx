import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import type { LoginResponse } from '../types';
import { Card } from '../components/Card';

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
    <div className="mx-auto flex min-h-screen max-w-3xl items-center px-4 py-10">
      <Card className="w-full">
        <p className="text-sm uppercase tracking-[0.3em] text-brand-maroon/70">Login</p>
        <h1 className="mt-3 text-4xl font-semibold text-brand-ink">Welcome back</h1>
        <form onSubmit={submit} className="mt-8 space-y-4">
          <input className="w-full rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3" placeholder="Email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
          <input className="w-full rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3" placeholder="Password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
          {error ? <p className="text-sm text-red-700">{error}</p> : null}
          <button className="w-full rounded-2xl bg-brand-maroon px-5 py-3 text-sm font-semibold text-white">Login</button>
        </form>
      </Card>
    </div>
  );
}
