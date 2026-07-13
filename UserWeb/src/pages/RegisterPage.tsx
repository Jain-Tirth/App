import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import type { ProfileCreatedBy, RegisterResponse } from '../types';
import { Card } from '../components/Card';

const createdByOptions: ProfileCreatedBy[] = [
  'myself',
  'son',
  'daughter',
  'brother',
  'sister',
  'friend',
  'relative',
];

function formatLabel(value: string) {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

interface RegisterPageProps {
  onRegistered: (data: {
    countryCode: string;
    mobileNumber: string;
    email: string;
    password: string;
    response: RegisterResponse;
  }) => void;
}

export function RegisterPage({ onRegistered }: RegisterPageProps) {
  const navigate = useNavigate();
  const [profileCreatedBy, setProfileCreatedBy] = useState<ProfileCreatedBy>('myself');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [countryCode, setCountryCode] = useState('+91');
  const [mobileNumber, setMobileNumber] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await api.register({
        fullName,
        email,
        password,
        countryCode,
        mobileNumber,
        profileCreatedBy,
      });

      onRegistered({
        countryCode,
        mobileNumber,
        email,
        password,
        response,
      });
      navigate('/otp');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-6xl items-center px-4 py-10">
      <Card className="w-full">
        <p className="text-sm uppercase tracking-[0.3em] text-brand-maroon/70">Screen 2 + 3</p>
        <h1 className="mt-3 text-4xl font-semibold text-brand-ink">Create your profile</h1>
        <form onSubmit={handleSubmit} className="mt-8 grid gap-6 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className="text-sm font-semibold text-brand-ink">Profile created for</label>
            <div className="mt-3 flex flex-wrap gap-2">
              {createdByOptions.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setProfileCreatedBy(option)}
                  className={`rounded-full px-4 py-2 text-sm ${
                    profileCreatedBy === option
                      ? 'bg-brand-maroon text-white'
                      : 'border border-stone-200 bg-stone-50 text-brand-ink'
                  }`}
                >
                  {formatLabel(option)}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-sm font-semibold">Full Name</label>
            <input className="mt-2 w-full rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3" value={fullName} onChange={(event) => setFullName(event.target.value)} />
          </div>
          <div>
            <label className="text-sm font-semibold">Email</label>
            <input className="mt-2 w-full rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
          </div>
          <div>
            <label className="text-sm font-semibold">Password</label>
            <input className="mt-2 w-full rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3" type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
          </div>
          <div>
            <label className="text-sm font-semibold">Mobile Number</label>
            <div className="mt-2 flex gap-2">
              <input className="w-24 rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3" value={countryCode} onChange={(event) => setCountryCode(event.target.value)} />
              <input className="flex-1 rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3" value={mobileNumber} onChange={(event) => setMobileNumber(event.target.value)} />
            </div>
          </div>
          {error ? <p className="md:col-span-2 text-sm text-red-700">{error}</p> : null}
          <div className="md:col-span-2">
            <button className="w-full rounded-2xl bg-brand-maroon px-5 py-3 text-sm font-semibold text-white" disabled={loading}>
              {loading ? 'Requesting OTP...' : 'Get OTP'}
            </button>
          </div>
        </form>
      </Card>
    </div>
  );
}
