import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import type { ProfileResponse } from '../types';
import { Logo } from '../components/Logo';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import {
  User,
  Sparkles,
  MapPin,
  GraduationCap,
  Heart,
  ChevronRight,
  ChevronLeft,
  Check,
  AlertCircle,
  ShieldCheck,
  Info,
} from 'lucide-react';

interface WizardPageProps {
  token: string;
  profile: ProfileResponse | null;
  onProfileUpdate: (profile: ProfileResponse) => void;
}

const STEPS = [
  { id: 1, title: 'Personal Details', icon: User, desc: 'Basic identity & lifestyle' },
  { id: 2, title: 'Religion & Cultural', icon: Sparkles, desc: 'Caste, gothra & dosh' },
  { id: 3, title: 'Location & Residence', icon: MapPin, desc: 'Where you currently live' },
  { id: 4, title: 'Education & Career', icon: GraduationCap, desc: 'Degree, job & income' },
  { id: 5, title: 'Family & Partner', icon: Heart, desc: 'About you & expectations' },
];

function cmToFeetInches(cm: number): string {
  if (!cm || isNaN(cm)) return '';
  const totalInches = cm / 2.54;
  const feet = Math.floor(totalInches / 12);
  const inches = Math.round(totalInches % 12);
  return `${feet} ft ${inches} in`;
}

function calculateAge(dobString: string): number | null {
  if (!dobString) return null;
  const birth = new Date(dobString);
  if (isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age > 0 ? age : null;
}

export function WizardPage({ token, profile, onProfileUpdate }: WizardPageProps) {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Step 1: Personal
  const [step1, setStep1] = useState({
    gender: (profile?.profile?.user.gender as 'male' | 'female' | null) ?? 'male',
    dateOfBirth: (profile?.profile?.personalDetails?.dateOfBirth as string | undefined)?.slice(0, 10) ?? '',
    heightCm: Number(profile?.profile?.personalDetails?.heightCm ?? 165),
    weightKg: Number(profile?.profile?.personalDetails?.weightKg ?? 65),
    physicalStatus: (profile?.profile?.personalDetails?.physicalStatus as 'normal' | 'physicallyChallenged') ?? 'normal',
    maritalStatus: (profile?.profile?.personalDetails?.maritalStatus as string | undefined) ?? 'neverMarried',
    eatingHabits: (profile?.profile?.personalDetails?.eatingHabits as 'vegetarian' | 'nonVegetarian' | 'eggetarian') ?? 'vegetarian',
  });

  // Step 2: Religious & Cultural
  const [step2, setStep2] = useState({
    religion: String(profile?.profile?.religiousDetails?.religion ?? 'Hindu'),
    caste: String(profile?.profile?.religiousDetails?.caste ?? 'Dhobi / Rajaka'),
    subcaste: String(profile?.profile?.religiousDetails?.subcaste ?? ''),
    gothra: String(profile?.profile?.religiousDetails?.gothra ?? ''),
    openToAnySubcaste: Boolean(profile?.profile?.religiousDetails?.openToAnySubcaste ?? false),
    dosh: String(profile?.profile?.religiousDetails?.dosh ?? 'no'),
  });

  // Step 3: Location
  const [step3, setStep3] = useState({
    country: String(profile?.profile?.locationDetails?.country ?? 'India'),
    state: String(profile?.profile?.locationDetails?.state ?? ''),
    city: String(profile?.profile?.locationDetails?.city ?? ''),
  });

  // Step 4: Professional
  const [step4, setStep4] = useState({
    education: String(profile?.profile?.professionalDetails?.education ?? ''),
    employmentType: String(profile?.profile?.professionalDetails?.employmentType ?? 'private'),
    occupation: String(profile?.profile?.professionalDetails?.occupation ?? ''),
    incomeCurrency: 'INR',
    annualIncomeRange: String(profile?.profile?.professionalDetails?.annualIncomeRange ?? ''),
  });

  // Step 5: Family & Partner Expectations
  const [step5, setStep5] = useState({
    familyStatus: String(profile?.profile?.additionalDetails?.familyStatus ?? 'Middle Class'),
    aboutMyself: String(profile?.profile?.additionalDetails?.aboutMyself ?? ''),
    lookingFor: String(profile?.profile?.additionalDetails?.lookingFor ?? ''),
  });

  const age = useMemo(() => calculateAge(step1.dateOfBirth), [step1.dateOfBirth]);
  const heightFormatted = useMemo(() => cmToFeetInches(step1.heightCm), [step1.heightCm]);

  async function saveCurrentStep() {
    setLoading(true);
    setError('');

    try {
      let response: ProfileResponse;

      if (step === 1) {
        if (!step1.dateOfBirth) {
          setError('Please provide your date of birth.');
          setLoading(false);
          return;
        }
        if (age !== null && age < 18) {
          setError('Candidate must be at least 18 years old.');
          setLoading(false);
          return;
        }

        response = await api.saveStep1(token, {
          gender: step1.gender,
          dateOfBirth: step1.dateOfBirth,
          heightCm: Number(step1.heightCm),
          weightKg: step1.weightKg ? Number(step1.weightKg) : undefined,
          physicalStatus: step1.physicalStatus,
          maritalStatus: step1.maritalStatus as 'neverMarried' | 'widower' | 'awaitingDivorce' | 'divorced',
          eatingHabits: step1.eatingHabits,
        });
      } else if (step === 2) {
        response = await api.saveStep2(token, step2);
      } else if (step === 3) {
        if (!step3.city.trim() || !step3.state.trim()) {
          setError('Please enter your state and city.');
          setLoading(false);
          return;
        }
        response = await api.saveStep3(token, step3);
      } else if (step === 4) {
        if (!step4.education.trim()) {
          setError('Please enter your highest qualification.');
          setLoading(false);
          return;
        }
        response = await api.saveStep4(token, step4);
      } else {
        if (!step5.aboutMyself.trim()) {
          setError('Please share a few lines about yourself.');
          setLoading(false);
          return;
        }
        response = await api.saveStep5(token, step5);
      }

      onProfileUpdate(response);

      if (step < 5) {
        setStep((current) => current + 1);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        navigate('/pending');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save step details.');
    } finally {
      setLoading(false);
    }
  }

  const completionPct = profile?.completion?.percentage ?? Math.round(((step - 1) / 5) * 100);

  return (
    <div className="min-h-screen bg-brand-canvas py-8 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl space-y-6">
        {/* Header with Logo and Trust Badge */}
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-brand-border/60">
          <Logo variant="navbar" showTagline={false} />
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 text-xs font-medium text-brand-muted bg-white border border-brand-border px-3 py-1.5 rounded-full shadow-sm">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              100% Verified Community Profiles
            </span>
            <Badge variant="secondary" className="font-mono text-xs">
              {completionPct}% Complete
            </Badge>
          </div>
        </header>

        {/* Step Progress Tracker */}
        <div className="rounded-2xl border border-brand-border bg-white p-4 shadow-soft">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-brand-muted">
              Step {step} of 5: <span className="text-brand-charcoal">{STEPS[step - 1].title}</span>
            </span>
            <span className="text-xs font-bold text-brand-primary">{Math.max(completionPct, Math.round((step / 5) * 100))}% Finished</span>
          </div>

          {/* Progress Line */}
          <div className="h-2 w-full overflow-hidden rounded-full bg-brand-primary-soft">
            <div
              className="h-full rounded-full bg-brand-primary transition-all duration-500 ease-out shadow-sm"
              style={{ width: `${Math.max(completionPct, Math.round((step / 5) * 100))}%` }}
            />
          </div>

          {/* Steps Breadcrumbs (Desktop / Tablet) */}
          <div className="mt-4 hidden sm:grid grid-cols-5 gap-2 pt-2 border-t border-brand-border/40">
            {STEPS.map((s) => {
              const Icon = s.icon;
              const isPast = s.id < step;
              const isCurrent = s.id === step;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => s.id < step && setStep(s.id)}
                  disabled={s.id > step}
                  className={`flex flex-col items-center text-center p-2 rounded-xl transition-all ${
                    isCurrent
                      ? 'bg-brand-primary-soft text-brand-primary font-semibold ring-1 ring-brand-primary/30'
                      : isPast
                      ? 'text-brand-charcoal hover:bg-brand-canvas cursor-pointer'
                      : 'text-brand-muted/40 cursor-not-allowed'
                  }`}
                >
                  <div
                    className={`flex h-7 w-7 items-center justify-center rounded-full mb-1.5 text-xs transition-colors ${
                      isPast
                        ? 'bg-emerald-600 text-white'
                        : isCurrent
                        ? 'bg-brand-primary text-white shadow-sm'
                        : 'bg-brand-border/60 text-brand-muted'
                    }`}
                  >
                    {isPast ? <Check className="h-3.5 w-3.5" /> : s.id}
                  </div>
                  <span className="text-xs truncate w-full">{s.title}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Main Form Card */}
        <Card className="shadow-soft border-brand-border bg-white">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-brand-primary">
              <span>Step 0{step}</span>
              <span>•</span>
              <span>{STEPS[step - 1].desc}</span>
            </div>
            <CardTitle className="text-2xl sm:text-3xl font-bold font-serif text-brand-charcoal">
              {STEPS[step - 1].title}
            </CardTitle>
            <CardDescription className="text-sm text-brand-muted">
              {step === 1 && 'Accurate personal details ensure high compatibility and genuine interest from prospective matches.'}
              {step === 2 && 'Cultural and astrological details are honored with high reverence in our community.'}
              {step === 3 && 'Help potential matches know your current city and relocation preferences.'}
              {step === 4 && 'Your educational background and career milestone play an important role in matchmaking.'}
              {step === 5 && 'Share your family background and what you are looking for in your life partner.'}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            {error ? (
              <div className="flex items-center gap-2.5 rounded-xl border border-red-200 bg-red-50 p-4 text-xs font-medium text-red-700 animate-in fade-in">
                <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
                <span>{error}</span>
              </div>
            ) : null}

            {/* STEP 1: PERSONAL DETAILS */}
            {step === 1 ? (
              <div className="space-y-6">
                {/* Gender Selector Cards */}
                <div className="space-y-2">
                  <Label>Gender of Candidate</Label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setStep1({ ...step1, gender: 'male' })}
                      className={`flex items-center justify-center gap-2.5 p-3.5 rounded-xl border text-sm font-semibold transition-all ${
                        step1.gender === 'male'
                          ? 'border-brand-primary bg-brand-primary-soft text-brand-primary shadow-sm'
                          : 'border-brand-border bg-white text-brand-charcoal hover:bg-brand-canvas'
                      }`}
                    >
                      <User className="h-4 w-4" />
                      <span>Groom (Male)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setStep1({ ...step1, gender: 'female' })}
                      className={`flex items-center justify-center gap-2.5 p-3.5 rounded-xl border text-sm font-semibold transition-all ${
                        step1.gender === 'female'
                          ? 'border-brand-primary bg-brand-primary-soft text-brand-primary shadow-sm'
                          : 'border-brand-border bg-white text-brand-charcoal hover:bg-brand-canvas'
                      }`}
                    >
                      <User className="h-4 w-4" />
                      <span>Bride (Female)</span>
                    </button>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  {/* Date of Birth */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="dob">Date of Birth</Label>
                      {age !== null && (
                        <span className="text-xs font-semibold text-brand-primary bg-brand-primary-soft px-2 py-0.5 rounded-md">
                          {age} years old
                        </span>
                      )}
                    </div>
                    <Input
                      id="dob"
                      type="date"
                      value={step1.dateOfBirth}
                      max={new Date().toISOString().split('T')[0]}
                      onChange={(e) => setStep1({ ...step1, dateOfBirth: e.target.value })}
                    />
                  </div>

                  {/* Marital Status */}
                  <div className="space-y-1.5">
                    <Label htmlFor="maritalStatus">Marital Status</Label>
                    <select
                      id="maritalStatus"
                      className="flex h-11 w-full rounded-xl border border-brand-border bg-white px-4 py-2.5 text-sm text-brand-charcoal focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
                      value={step1.maritalStatus}
                      onChange={(e) => setStep1({ ...step1, maritalStatus: e.target.value })}
                    >
                      <option value="neverMarried">Never Married</option>
                      <option value="widower">Widowed</option>
                      <option value="divorced">Divorced</option>
                      <option value="awaitingDivorce">Awaiting Divorce</option>
                    </select>
                  </div>

                  {/* Height */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="heightCm">Height (cm)</Label>
                      {heightFormatted && (
                        <span className="text-xs font-medium text-brand-muted">
                          Approx: {heightFormatted}
                        </span>
                      )}
                    </div>
                    <Input
                      id="heightCm"
                      type="number"
                      min={120}
                      max={230}
                      placeholder="e.g. 165"
                      value={step1.heightCm || ''}
                      onChange={(e) => setStep1({ ...step1, heightCm: Number(e.target.value) })}
                    />
                  </div>

                  {/* Weight (Optional) */}
                  <div className="space-y-1.5">
                    <Label htmlFor="weightKg">Weight (kg) - Optional</Label>
                    <Input
                      id="weightKg"
                      type="number"
                      min={30}
                      max={180}
                      placeholder="e.g. 62"
                      value={step1.weightKg || ''}
                      onChange={(e) => setStep1({ ...step1, weightKg: Number(e.target.value) })}
                    />
                  </div>

                  {/* Physical Status */}
                  <div className="space-y-1.5">
                    <Label htmlFor="physicalStatus">Physical Status</Label>
                    <select
                      id="physicalStatus"
                      className="flex h-11 w-full rounded-xl border border-brand-border bg-white px-4 py-2.5 text-sm text-brand-charcoal focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
                      value={step1.physicalStatus}
                      onChange={(e) => setStep1({ ...step1, physicalStatus: e.target.value as 'normal' | 'physicallyChallenged' })}
                    >
                      <option value="normal">Normal / Physically Fit</option>
                      <option value="physicallyChallenged">Physically Challenged</option>
                    </select>
                  </div>

                  {/* Eating Habits */}
                  <div className="space-y-1.5">
                    <Label htmlFor="eatingHabits">Diet / Eating Habits</Label>
                    <select
                      id="eatingHabits"
                      className="flex h-11 w-full rounded-xl border border-brand-border bg-white px-4 py-2.5 text-sm text-brand-charcoal focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
                      value={step1.eatingHabits}
                      onChange={(e) => setStep1({ ...step1, eatingHabits: e.target.value as 'vegetarian' | 'nonVegetarian' | 'eggetarian' })}
                    >
                      <option value="vegetarian">Vegetarian</option>
                      <option value="nonVegetarian">Non-Vegetarian</option>
                      <option value="eggetarian">Eggetarian</option>
                    </select>
                  </div>
                </div>
              </div>
            ) : null}

            {/* STEP 2: RELIGION & CULTURAL */}
            {step === 2 ? (
              <div className="space-y-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="religion">Religion</Label>
                    <Input
                      id="religion"
                      value={step2.religion}
                      placeholder="e.g. Hindu"
                      onChange={(e) => setStep2({ ...step2, religion: e.target.value })}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="caste">Caste / Community</Label>
                    <Input
                      id="caste"
                      value={step2.caste}
                      placeholder="e.g. Dhobi / Rajaka / Madivala"
                      onChange={(e) => setStep2({ ...step2, caste: e.target.value })}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="subcaste">Subcaste (Optional)</Label>
                    <Input
                      id="subcaste"
                      value={step2.subcaste}
                      placeholder="e.g. Telugu Rajaka / Kanaujiya"
                      onChange={(e) => setStep2({ ...step2, subcaste: e.target.value })}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="gothra">Gothra / Lineage</Label>
                    <Input
                      id="gothra"
                      value={step2.gothra}
                      placeholder="e.g. Shiva / Kashyap / Don't know"
                      onChange={(e) => setStep2({ ...step2, gothra: e.target.value })}
                    />
                  </div>

                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="dosh">Manglik / Chevvai Dosh</Label>
                    <select
                      id="dosh"
                      className="flex h-11 w-full rounded-xl border border-brand-border bg-white px-4 py-2.5 text-sm text-brand-charcoal focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
                      value={step2.dosh}
                      onChange={(e) => setStep2({ ...step2, dosh: e.target.value })}
                    >
                      <option value="no">No Dosh / Non-Manglik</option>
                      <option value="yes">Yes (Manglik / Sevvai Dosham)</option>
                      <option value="dontKnow">Don&apos;t Know / Not Checked</option>
                    </select>
                  </div>
                </div>

                {/* Subcaste Tolerance Card */}
                <div className="rounded-xl border border-brand-border bg-brand-primary-soft/30 p-4 transition-colors hover:border-brand-primary/40">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={step2.openToAnySubcaste}
                      onChange={(e) => setStep2({ ...step2, openToAnySubcaste: e.target.checked })}
                      className="h-4 w-4 rounded accent-brand-primary"
                    />
                    <div className="text-left">
                      <span className="block text-sm font-semibold text-brand-charcoal">
                        Open to marry from any subcaste within community
                      </span>
                      <span className="block text-xs text-brand-muted">
                        Expanding this option broadens your recommended matches significantly.
                      </span>
                    </div>
                  </label>
                </div>
              </div>
            ) : null}

            {/* STEP 3: LOCATION & RESIDENCE */}
            {step === 3 ? (
              <div className="space-y-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="country">Country</Label>
                    <Input
                      id="country"
                      value={step3.country}
                      placeholder="India"
                      onChange={(e) => setStep3({ ...step3, country: e.target.value })}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="state">State</Label>
                    <Input
                      id="state"
                      value={step3.state}
                      placeholder="e.g. Telangana / Andhra Pradesh / Maharashtra"
                      onChange={(e) => setStep3({ ...step3, state: e.target.value })}
                    />
                  </div>

                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="city">City / District of Current Residence</Label>
                    <Input
                      id="city"
                      value={step3.city}
                      placeholder="e.g. Hyderabad / Visakhapatnam / Pune"
                      onChange={(e) => setStep3({ ...step3, city: e.target.value })}
                    />
                  </div>
                </div>

                <div className="flex items-start gap-2.5 rounded-xl border border-brand-border bg-brand-canvas p-3.5 text-xs text-brand-muted">
                  <Info className="h-4 w-4 shrink-0 text-brand-primary mt-0.5" />
                  <span>
                    Your exact street address will never be shared publicly. Only City, State, and Country are displayed on your profile.
                  </span>
                </div>
              </div>
            ) : null}

            {/* STEP 4: EDUCATION & CAREER */}
            {step === 4 ? (
              <div className="space-y-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="education">Highest Qualification</Label>
                    <Input
                      id="education"
                      value={step4.education}
                      placeholder="e.g. B.Tech / MBA / MBBS / Degree"
                      onChange={(e) => setStep4({ ...step4, education: e.target.value })}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="employmentType">Employment Sector</Label>
                    <select
                      id="employmentType"
                      className="flex h-11 w-full rounded-xl border border-brand-border bg-white px-4 py-2.5 text-sm text-brand-charcoal focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
                      value={step4.employmentType}
                      onChange={(e) => setStep4({ ...step4, employmentType: e.target.value })}
                    >
                      <option value="private">Private Sector (Corporate / MNC)</option>
                      <option value="governmentPsu">Government / PSU Sector</option>
                      <option value="business">Business / Entrepreneurship</option>
                      <option value="defence">Defence & Armed Forces</option>
                      <option value="selfEmployed">Self Employed / Professional</option>
                      <option value="notWorking">Not Currently Working</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="occupation">Occupation / Job Title</Label>
                    <Input
                      id="occupation"
                      value={step4.occupation}
                      placeholder="e.g. Software Engineer / Bank Officer / Manager"
                      onChange={(e) => setStep4({ ...step4, occupation: e.target.value })}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="income">Annual Income Range</Label>
                    <select
                      id="income"
                      className="flex h-11 w-full rounded-xl border border-brand-border bg-white px-4 py-2.5 text-sm text-brand-charcoal focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
                      value={step4.annualIncomeRange}
                      onChange={(e) => setStep4({ ...step4, annualIncomeRange: e.target.value })}
                    >
                      <option value="">Select Income Bracket</option>
                      <option value="Below 3 Lakhs">Below ₹3 Lakhs</option>
                      <option value="3 - 5 Lakhs">₹3 - ₹5 Lakhs</option>
                      <option value="5 - 8 Lakhs">₹5 - ₹8 Lakhs</option>
                      <option value="8 - 12 Lakhs">₹8 - ₹12 Lakhs</option>
                      <option value="12 - 18 Lakhs">₹12 - ₹18 Lakhs</option>
                      <option value="18 - 25 Lakhs">₹18 - ₹25 Lakhs</option>
                      <option value="25 - 40 Lakhs">₹25 - ₹40 Lakhs</option>
                      <option value="40+ Lakhs">₹40+ Lakhs</option>
                    </select>
                  </div>
                </div>
              </div>
            ) : null}

            {/* STEP 5: FAMILY & PARTNER EXPECTATIONS */}
            {step === 5 ? (
              <div className="space-y-5">
                <div className="space-y-1.5">
                  <Label htmlFor="familyStatus">Family Status</Label>
                  <select
                    id="familyStatus"
                    className="flex h-11 w-full rounded-xl border border-brand-border bg-white px-4 py-2.5 text-sm text-brand-charcoal focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
                    value={step5.familyStatus}
                    onChange={(e) => setStep5({ ...step5, familyStatus: e.target.value })}
                  >
                    <option value="Middle Class">Middle Class</option>
                    <option value="Upper Middle Class">Upper Middle Class</option>
                    <option value="Rich / Affluent">Rich / Affluent</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="aboutMyself">About Myself & Background</Label>
                    <span className="text-xs text-brand-muted">{step5.aboutMyself.length}/1000</span>
                  </div>
                  <Textarea
                    id="aboutMyself"
                    rows={4}
                    maxLength={1000}
                    value={step5.aboutMyself}
                    onChange={(e) => setStep5({ ...step5, aboutMyself: e.target.value })}
                    placeholder="Share a short introduction: your character, hobbies, core family values, and what drives you in life..."
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="lookingFor">Partner Expectations</Label>
                    <span className="text-xs text-brand-muted">{step5.lookingFor.length}/1000</span>
                  </div>
                  <Textarea
                    id="lookingFor"
                    rows={4}
                    maxLength={1000}
                    value={step5.lookingFor}
                    onChange={(e) => setStep5({ ...step5, lookingFor: e.target.value })}
                    placeholder="Describe your ideal companion: education preference, mutual values, lifestyle compatibility, or location preferences..."
                  />
                </div>
              </div>
            ) : null}
          </CardContent>

          {/* Form Actions Footer */}
          <CardFooter className="flex items-center justify-between border-t border-brand-border/60 pt-6">
            <Button
              type="button"
              variant="outline"
              disabled={step === 1 || loading}
              onClick={() => {
                setError('');
                setStep((curr) => Math.max(1, curr - 1));
              }}
              className="gap-2"
            >
              <ChevronLeft className="h-4 w-4" />
              <span>Back</span>
            </Button>

            <Button
              type="button"
              disabled={loading}
              onClick={() => void saveCurrentStep()}
              className="gap-2 px-8"
            >
              <span>{loading ? 'Saving...' : step === 5 ? 'Submit for Verification' : 'Save & Continue'}</span>
              {!loading && <ChevronRight className="h-4 w-4" />}
            </Button>
          </CardFooter>
        </Card>

        {/* Community Trust Seal */}
        <p className="text-center text-xs text-brand-muted">
          By submitting your details, you agree to Dhobi Matrimony community conduct guidelines. All profiles are reviewed manually by our administration team.
        </p>
      </div>
    </div>
  );
}
