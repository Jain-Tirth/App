import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { api } from '../api';
import { hasErrorCode } from '../apiError';
import { Card } from '../components/Card';
import { ConsentChecklist } from '../components/ConsentChecklist';
import { ErrorNotice, FieldError } from '../components/ErrorNotice';
import { Logo } from '../components/Logo';
import { describeError, type FriendlyError } from '../errors/messages';
import { buildConsentPayload } from '../lib/consents';
import type {
  ConsentDocument,
  ConsentLanguage,
  ProfileCreatedBy,
  RegisterResponse,
} from '../types';

export interface OtpContext {
  countryCode: string;
  mobileNumber: string;
  email: string;
  response: RegisterResponse;
}

interface SignupPageProps {
  onRegistered: (context: OtpContext) => void;
}

const CREATED_BY: Array<{ value: ProfileCreatedBy; label: string }> = [
  { value: 'myself', label: 'Myself' },
  { value: 'son', label: 'My son' },
  { value: 'daughter', label: 'My daughter' },
  { value: 'brother', label: 'My brother' },
  { value: 'sister', label: 'My sister' },
  { value: 'friend', label: 'My friend' },
  { value: 'relative', label: 'A relative' },
];

const COUNTRY_CODES = ['+91', '+1', '+44', '+61', '+65', '+971'];

const INPUT_CLASS =
  'mt-1 w-full rounded-xl border border-brand-border bg-brand-canvas px-4 py-3 text-sm text-brand-charcoal focus:border-brand-primary focus:outline-none';
const LABEL_CLASS = 'block text-xs font-semibold uppercase tracking-wider text-brand-muted';

export function SignupPage({ onRegistered }: SignupPageProps) {
  const navigate = useNavigate();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [countryCode, setCountryCode] = useState('+91');
  const [mobileNumber, setMobileNumber] = useState('');
  const [profileCreatedBy, setProfileCreatedBy] = useState<ProfileCreatedBy>('myself');
  const [language, setLanguage] = useState<ConsentLanguage>('en');
  const [documents, setDocuments] = useState<ConsentDocument[]>([]);
  const [accepted, setAccepted] = useState<Record<string, boolean>>({});
  const [reloadKey, setReloadKey] = useState(0);
  const [error, setError] = useState<FriendlyError | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const consents = buildConsentPayload(documents, accepted);
  const fieldErrors = error?.fields ?? {};

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!consents) return;
    setError(null);
    setSubmitting(true);
    try {
      const response = await api.register({
        fullName: fullName.trim(),
        email: email.trim(),
        password,
        countryCode,
        mobileNumber,
        profileCreatedBy,
        language,
        consents,
      });
      onRegistered({ countryCode, mobileNumber, email: email.trim(), response });
      navigate('/otp');
    } catch (err) {
      setError(describeError(err, 'register'));
      if (hasErrorCode(err, 'CONSENT_REQUIRED', 'CONSENT_DOCUMENT_MISMATCH')) {
        // The documents changed or a box was missed: reload them and ask again.
        setAccepted({});
        setReloadKey((key) => key + 1);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-xl items-center px-4 py-10">
      <Card className="w-full p-8 sm:p-10">
        <button onClick={() => navigate('/')} className="mb-6 block text-left">
          <Logo variant="navbar" showTagline={false} />
        </button>

        <h1 className="text-3xl font-serif font-bold text-brand-charcoal">Create your account</h1>
        <p className="mt-1 text-sm text-brand-muted">
          Register for free. We will verify your mobile number next.
        </p>

        <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
          <div>
            <label htmlFor="signup-fullname" className={LABEL_CLASS}>
              Full name
            </label>
            <input
              id="signup-fullname"
              data-testid="signup-fullname"
              className={INPUT_CLASS}
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              autoComplete="name"
            />
            <FieldError name="fullName" text={fieldErrors.fullName} />
          </div>

          <div>
            <label htmlFor="signup-email" className={LABEL_CLASS}>
              Email address
            </label>
            <input
              id="signup-email"
              data-testid="signup-email"
              className={INPUT_CLASS}
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
            />
            <FieldError name="email" text={fieldErrors.email} />
          </div>

          <div>
            <label htmlFor="signup-password" className={LABEL_CLASS}>
              Password
            </label>
            <div className="relative">
              <input
                id="signup-password"
                data-testid="signup-password"
                className={INPUT_CLASS}
                type={showPassword ? 'text' : 'password'}
                value={password}
                maxLength={20}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="new-password"
              />
              <button
                type="button"
                data-testid="signup-password-toggle"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                onClick={() => setShowPassword((shown) => !shown)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-muted"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <p data-testid="signup-password-rules" className="mt-1 text-xs text-brand-muted">
              Use 8 to 20 characters.
            </p>
            <FieldError name="password" text={fieldErrors.password} />
          </div>

          <div>
            <span className={LABEL_CLASS}>Mobile number</span>
            <div className="flex gap-2">
              <select
                data-testid="signup-country-code"
                aria-label="Country code"
                className={`${INPUT_CLASS} w-28`}
                value={countryCode}
                onChange={(event) => setCountryCode(event.target.value)}
              >
                {COUNTRY_CODES.map((code) => (
                  <option key={code} value={code}>
                    {code}
                  </option>
                ))}
              </select>
              <input
                data-testid="signup-mobile"
                aria-label="Mobile number"
                className={INPUT_CLASS}
                inputMode="numeric"
                maxLength={10}
                value={mobileNumber}
                onChange={(event) => setMobileNumber(event.target.value.replace(/\D/g, ''))}
                autoComplete="tel-national"
              />
            </div>
            <FieldError name="mobileNumber" text={fieldErrors.mobileNumber} />
            <FieldError name="countryCode" text={fieldErrors.countryCode} />
          </div>

          <div>
            <label htmlFor="signup-created-by" className={LABEL_CLASS}>
              This profile is for
            </label>
            <select
              id="signup-created-by"
              data-testid="signup-created-by"
              className={INPUT_CLASS}
              value={profileCreatedBy}
              onChange={(event) => setProfileCreatedBy(event.target.value as ProfileCreatedBy)}
            >
              {CREATED_BY.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
            <FieldError name="profileCreatedBy" text={fieldErrors.profileCreatedBy} />
          </div>

          <ConsentChecklist
            language={language}
            onLanguageChange={setLanguage}
            accepted={accepted}
            onAcceptedChange={setAccepted}
            onDocumentsChange={setDocuments}
            reloadKey={reloadKey}
          />
          <FieldError name="consents" text={fieldErrors.consents} />

          <ErrorNotice error={error} testId="signup-error" />

          <button
            type="submit"
            data-testid="signup-submit"
            disabled={!consents || submitting}
            className="w-full rounded-xl bg-brand-primary px-5 py-3 text-sm font-semibold text-white shadow-button transition-all hover:bg-brand-primary-hover disabled:pointer-events-none disabled:opacity-50"
          >
            {submitting ? 'Creating account...' : 'Create account'}
          </button>

          <p className="text-center text-sm text-brand-muted">
            Already have an account?{' '}
            <button
              type="button"
              data-testid="signup-to-login"
              onClick={() => navigate('/login')}
              className="font-semibold text-brand-primary hover:underline"
            >
              Sign in
            </button>
          </p>
        </form>
      </Card>
    </div>
  );
}
