import { useEffect, useState, type FormEvent } from 'react';
import {
  Navigate,
  Route,
  Routes,
  useNavigate,
} from 'react-router-dom';
import { api } from './api';
import type {
  LoginResponse,
  ProfileCreatedBy,
  ProfileResponse,
  RegisterResponse,
} from './types';

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

function Card({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-[2rem] border border-brand-gold/35 bg-white/90 p-6 shadow-soft ${className}`}>
      {children}
    </div>
  );
}

function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <Card className="max-w-5xl overflow-hidden p-0 md:grid md:grid-cols-[1.2fr,0.8fr]">
        <div className="bg-brand-maroon px-8 py-10 text-white">
          <p className="text-sm uppercase tracking-[0.35em] text-brand-gold">
            Tradition • Trust • Togetherness
          </p>
          <h1 className="mt-4 text-5xl font-semibold">Dhobi Matrimony</h1>
          <p className="mt-5 max-w-lg text-base leading-7 text-white/80">
            Verified profiles, guided registration, and a focused matching experience for the Dhobi community across web and mobile.
          </p>
          <div className="mt-8 flex flex-wrap gap-3 text-sm">
            <span className="rounded-full border border-white/20 px-4 py-2">100% Verified Profiles</span>
            <span className="rounded-full border border-white/20 px-4 py-2">Trusted by Thousands</span>
            <span className="rounded-full border border-white/20 px-4 py-2">Privacy Assured</span>
          </div>
        </div>
        <div className="bg-brand-cream px-8 py-10">
          <p className="text-sm uppercase tracking-[0.3em] text-brand-maroon/70">Start Here</p>
          <h2 className="mt-3 text-3xl font-semibold text-brand-ink">Find your match with a guided profile flow</h2>
          <button
            onClick={() => navigate('/register')}
            className="mt-8 w-full rounded-2xl bg-brand-maroon px-5 py-3 text-sm font-semibold text-white"
          >
            Create Profile
          </button>
          <button
            onClick={() => navigate('/login')}
            className="mt-3 w-full rounded-2xl border border-brand-maroon px-5 py-3 text-sm font-semibold text-brand-maroon"
          >
            Login
          </button>
        </div>
      </Card>
    </div>
  );
}

function RegisterPage({
  onRegistered,
}: {
  onRegistered: (data: {
    countryCode: string;
    mobileNumber: string;
    email: string;
    password: string;
    response: RegisterResponse;
  }) => void;
}) {
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

function OtpPage({
  otpContext,
  onVerified,
}: {
  otpContext: {
    countryCode: string;
    mobileNumber: string;
    email: string;
    password: string;
    response: RegisterResponse;
  } | null;
  onVerified: (data: LoginResponse) => void;
}) {
  const navigate = useNavigate();
  const [otpCode, setOtpCode] = useState('');
  const [error, setError] = useState('');
  const [hint, setHint] = useState(otpContext?.response.otpCode ?? '');

  if (!otpContext) {
    return <Navigate to="/register" replace />;
  }

  async function verify(event: FormEvent) {
    event.preventDefault();
    setError('');
    try {
      const response = await api.verifyOtp(
        otpContext.countryCode,
        otpContext.mobileNumber,
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
        otpContext.countryCode,
        otpContext.mobileNumber,
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
          Please enter the 4-digit code sent to {otpContext.countryCode} {otpContext.mobileNumber}
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

function LoginPage({
  onLoggedIn,
}: {
  onLoggedIn: (data: LoginResponse) => void;
}) {
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

function PendingPage({
  profile,
  onLogout,
}: {
  profile: ProfileResponse | null;
  onLogout: () => void;
}) {
  return (
    <div className="mx-auto flex min-h-screen max-w-4xl items-center px-4 py-10">
      <Card className="w-full text-center">
        <p className="text-sm uppercase tracking-[0.3em] text-brand-maroon/70">Pending Approval</p>
        <h1 className="mt-4 text-4xl font-semibold text-brand-ink">Your profile is under review</h1>
        <p className="mt-4 text-brand-ink/70">
          Profile completion: {profile?.completion.percentage ?? 0}%.
          Once an admin approves your account, you can continue into the main matching experience.
        </p>
        {profile?.profile?.profileUid ? (
          <p className="mt-3 text-sm text-brand-maroon">Profile ID: {profile.profile.profileUid}</p>
        ) : null}
        <button onClick={onLogout} className="mt-8 rounded-2xl border border-brand-maroon px-5 py-3 text-sm font-semibold text-brand-maroon">
          Logout
        </button>
      </Card>
    </div>
  );
}

function WizardPage({
  token,
  profile,
  onProfileUpdate,
}: {
  token: string;
  profile: ProfileResponse | null;
  onProfileUpdate: (profile: ProfileResponse) => void;
}) {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const [step1, setStep1] = useState({
    gender: (profile?.profile?.user.gender as 'male' | 'female' | null) ?? 'male',
    dateOfBirth: (profile?.profile?.personalDetails.dateOfBirth as string | undefined)?.slice(0, 10) ?? '',
    heightCm: Number(profile?.profile?.personalDetails.heightCm ?? 160),
    physicalStatus: (profile?.profile?.personalDetails.physicalStatus as string | undefined) ?? 'normal',
    maritalStatus: (profile?.profile?.personalDetails.maritalStatus as string | undefined) ?? 'never_married',
  });
  const [step2, setStep2] = useState({
    religion: String(profile?.profile?.religiousDetails.religion ?? ''),
    caste: String(profile?.profile?.religiousDetails.caste ?? ''),
    subcaste: String(profile?.profile?.religiousDetails.subcaste ?? ''),
    gothra: String(profile?.profile?.religiousDetails.gothra ?? ''),
    openToAnySubcaste: Boolean(profile?.profile?.religiousDetails.openToAnySubcaste ?? false),
    dosh: String(profile?.profile?.religiousDetails.dosh ?? 'no'),
  });
  const [step3, setStep3] = useState({
    country: String(profile?.profile?.locationDetails.country ?? ''),
    state: String(profile?.profile?.locationDetails.state ?? ''),
    city: String(profile?.profile?.locationDetails.city ?? ''),
  });
  const [step4, setStep4] = useState({
    education: String(profile?.profile?.professionalDetails.education ?? ''),
    employmentType: String(profile?.profile?.professionalDetails.employmentType ?? 'private'),
    occupation: String(profile?.profile?.professionalDetails.occupation ?? ''),
    incomeCurrency: String(profile?.profile?.professionalDetails.incomeCurrency ?? 'INR'),
    annualIncomeRange: String(profile?.profile?.professionalDetails.annualIncomeRange ?? ''),
  });
  const [step5, setStep5] = useState({
    familyStatus: String(profile?.profile?.additionalDetails.familyStatus ?? 'middle_class'),
    aboutMyself: String(profile?.profile?.additionalDetails.aboutMyself ?? ''),
    lookingFor: String(profile?.profile?.additionalDetails.lookingFor ?? ''),
  });

  async function saveCurrentStep() {
    setLoading(true);
    setError('');

    try {
      let response: ProfileResponse;

      if (step === 1) {
        response = await api.saveStep1(token, {
          gender: step1.gender,
          dateOfBirth: step1.dateOfBirth,
          heightCm: Number(step1.heightCm),
          physicalStatus: step1.physicalStatus as 'normal' | 'physically_challenged',
          maritalStatus: step1.maritalStatus as
            | 'never_married'
            | 'widower'
            | 'awaiting_divorce'
            | 'divorced',
        });
      } else if (step === 2) {
        response = await api.saveStep2(token, step2);
      } else if (step === 3) {
        response = await api.saveStep3(token, step3);
      } else if (step === 4) {
        response = await api.saveStep4(token, step4);
      } else {
        response = await api.saveStep5(token, step5);
      }

      onProfileUpdate(response);

      if (step < 5) {
        setStep((current) => current + 1);
      } else {
        navigate('/pending');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save step');
    } finally {
      setLoading(false);
    }
  }

  const progress = profile?.completion.percentage ?? 0;

  return (
    <div className="mx-auto flex min-h-screen max-w-5xl items-center px-4 py-10">
      <Card className="w-full">
        <p className="text-sm uppercase tracking-[0.3em] text-brand-maroon/70">Registration Wizard</p>
        <h1 className="mt-3 text-4xl font-semibold text-brand-ink">Step {step} of 5</h1>
        <div className="mt-5 h-3 overflow-hidden rounded-full bg-brand-rose">
          <div className="h-full rounded-full bg-brand-maroon" style={{ width: `${progress}%` }} />
        </div>
        <p className="mt-2 text-sm text-brand-ink/65">Current completion: {progress}%</p>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {step === 1 ? (
            <>
              <select className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3" value={step1.gender} onChange={(event) => setStep1({ ...step1, gender: event.target.value as 'male' | 'female' })}>
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
              <input className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3" type="date" value={step1.dateOfBirth} onChange={(event) => setStep1({ ...step1, dateOfBirth: event.target.value })} />
              <input className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3" type="number" placeholder="Height in cm" value={step1.heightCm} onChange={(event) => setStep1({ ...step1, heightCm: Number(event.target.value) })} />
              <select className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3" value={step1.physicalStatus} onChange={(event) => setStep1({ ...step1, physicalStatus: event.target.value })}>
                <option value="normal">Normal</option>
                <option value="physically_challenged">Physically Challenged</option>
              </select>
              <select className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 md:col-span-2" value={step1.maritalStatus} onChange={(event) => setStep1({ ...step1, maritalStatus: event.target.value })}>
                <option value="never_married">Never Married</option>
                <option value="widower">Widower</option>
                <option value="awaiting_divorce">Awaiting Divorce</option>
                <option value="divorced">Divorced</option>
              </select>
            </>
          ) : null}

          {step === 2 ? (
            <>
              <input className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3" placeholder="Religion" value={step2.religion} onChange={(event) => setStep2({ ...step2, religion: event.target.value })} />
              <input className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3" placeholder="Caste" value={step2.caste} onChange={(event) => setStep2({ ...step2, caste: event.target.value })} />
              <input className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3" placeholder="Subcaste" value={step2.subcaste} onChange={(event) => setStep2({ ...step2, subcaste: event.target.value })} />
              <input className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3" placeholder="Gothra" value={step2.gothra} onChange={(event) => setStep2({ ...step2, gothra: event.target.value })} />
              <select className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3" value={step2.dosh} onChange={(event) => setStep2({ ...step2, dosh: event.target.value })}>
                <option value="no">No</option>
                <option value="yes">Yes</option>
                <option value="dont_know">Don't Know</option>
              </select>
              <label className="flex items-center gap-3 rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm">
                <input type="checkbox" checked={step2.openToAnySubcaste} onChange={(event) => setStep2({ ...step2, openToAnySubcaste: event.target.checked })} />
                Open to marry from any subcaste
              </label>
            </>
          ) : null}

          {step === 3 ? (
            <>
              <input className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3" placeholder="Country" value={step3.country} onChange={(event) => setStep3({ ...step3, country: event.target.value })} />
              <input className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3" placeholder="State" value={step3.state} onChange={(event) => setStep3({ ...step3, state: event.target.value })} />
              <input className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 md:col-span-2" placeholder="City" value={step3.city} onChange={(event) => setStep3({ ...step3, city: event.target.value })} />
            </>
          ) : null}

          {step === 4 ? (
            <>
              <input className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3" placeholder="Education" value={step4.education} onChange={(event) => setStep4({ ...step4, education: event.target.value })} />
              <select className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3" value={step4.employmentType} onChange={(event) => setStep4({ ...step4, employmentType: event.target.value })}>
                <option value="private">Private</option>
                <option value="business">Business</option>
                <option value="defence">Defence</option>
                <option value="government_psu">Government/PSU</option>
                <option value="not_working">Not Working</option>
                <option value="self_employed">Self Employed</option>
              </select>
              <input className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3" placeholder="Occupation" value={step4.occupation} onChange={(event) => setStep4({ ...step4, occupation: event.target.value })} />
              <input className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3" placeholder="Currency" value={step4.incomeCurrency} onChange={(event) => setStep4({ ...step4, incomeCurrency: event.target.value })} />
              <input className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 md:col-span-2" placeholder="Annual Income Range" value={step4.annualIncomeRange} onChange={(event) => setStep4({ ...step4, annualIncomeRange: event.target.value })} />
            </>
          ) : null}

          {step === 5 ? (
            <>
              <select className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 md:col-span-2" value={step5.familyStatus} onChange={(event) => setStep5({ ...step5, familyStatus: event.target.value })}>
                <option value="middle_class">Middle Class</option>
                <option value="upper_middle_class">Upper Middle Class</option>
                <option value="rich_affluent">Rich / Affluent</option>
              </select>
              <textarea className="min-h-32 rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 md:col-span-2" placeholder="A few words about myself" value={step5.aboutMyself} onChange={(event) => setStep5({ ...step5, aboutMyself: event.target.value })} />
              <textarea className="min-h-32 rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 md:col-span-2" placeholder="What we are looking for" value={step5.lookingFor} onChange={(event) => setStep5({ ...step5, lookingFor: event.target.value })} />
            </>
          ) : null}
        </div>

        {error ? <p className="mt-4 text-sm text-red-700">{error}</p> : null}
        <div className="mt-8 flex items-center justify-between">
          <button
            className="rounded-2xl border border-stone-200 px-5 py-3 text-sm"
            disabled={step === 1}
            onClick={() => setStep((current) => Math.max(1, current - 1))}
          >
            Back
          </button>
          <button
            className="rounded-2xl bg-brand-maroon px-5 py-3 text-sm font-semibold text-white"
            disabled={loading}
            onClick={() => void saveCurrentStep()}
          >
            {loading ? 'Saving...' : step === 5 ? 'Submit Profile' : 'Save & Next'}
          </button>
        </div>
      </Card>
    </div>
  );
}

function AppRouter() {
  const [accessToken, setAccessToken] = useState<string | null>(
    localStorage.getItem('user_access_token'),
  );
  const [refreshToken, setRefreshToken] = useState<string | null>(
    localStorage.getItem('user_refresh_token'),
  );
  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [otpContext, setOtpContext] = useState<{
    countryCode: string;
    mobileNumber: string;
    email: string;
    password: string;
    response: RegisterResponse;
  } | null>(null);

  useEffect(() => {
    async function loadProfile() {
      if (!accessToken) {
        setProfile(null);
        return;
      }

      try {
        const response = await api.getMyProfile(accessToken);
        setProfile(response);
      } catch {
        localStorage.removeItem('user_access_token');
        localStorage.removeItem('user_refresh_token');
        setAccessToken(null);
        setRefreshToken(null);
        setProfile(null);
      }
    }

    void loadProfile();
  }, [accessToken]);

  function handleAuth(response: LoginResponse) {
    localStorage.setItem('user_access_token', response.tokens.accessToken);
    localStorage.setItem('user_refresh_token', response.tokens.refreshToken);
    setAccessToken(response.tokens.accessToken);
    setRefreshToken(response.tokens.refreshToken);
  }

  function logout() {
    localStorage.removeItem('user_access_token');
    localStorage.removeItem('user_refresh_token');
    setAccessToken(null);
    setRefreshToken(null);
    setProfile(null);
  }

  const isProfileComplete = Boolean(profile?.profile) && profile.completion.completedSteps === 5;

  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/register" element={<RegisterPage onRegistered={setOtpContext} />} />
      <Route
        path="/otp"
        element={<OtpPage otpContext={otpContext} onVerified={handleAuth} />}
      />
      <Route
        path="/login"
        element={accessToken ? <Navigate to="/app" replace /> : <LoginPage onLoggedIn={handleAuth} />}
      />
      <Route
        path="/wizard"
        element={
          accessToken ? (
            <WizardPage token={accessToken} profile={profile} onProfileUpdate={setProfile} />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
      <Route
        path="/pending"
        element={
          accessToken ? (
            <PendingPage profile={profile} onLogout={logout} />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
      <Route
        path="/app"
        element={
          accessToken ? (
            isProfileComplete ? (
              <PendingPage profile={profile} onLogout={logout} />
            ) : (
              <Navigate to="/wizard" replace />
            )
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return <AppRouter />;
}
