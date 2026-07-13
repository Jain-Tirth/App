import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import type { ProfileResponse } from '../types';
import { Card } from '../components/Card';

interface WizardPageProps {
  token: string;
  profile: ProfileResponse | null;
  onProfileUpdate: (profile: ProfileResponse) => void;
}

export function WizardPage({ token, profile, onProfileUpdate }: WizardPageProps) {
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
