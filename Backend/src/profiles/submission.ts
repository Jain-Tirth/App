import { evaluateAgeGate, type AgeMinimums } from './age-gate';

export const SUBMISSION_STEPS = [
  'step-1',
  'step-2',
  'step-3',
  'step-4',
  'step-5',
] as const;

/** KYC case statuses in which the uploaded photo and ID can be reviewed. */
const REVIEWABLE_KYC_STATUSES: readonly string[] = ['needsReview', 'changesNeeded'];

/** What the repository knows about one member's readiness to submit. */
export interface SubmissionFacts {
  completedSteps: readonly string[];
  gender: 'male' | 'female' | null;
  dateOfBirth: string | null;
  kycStatus: string | null;
  hasPhoto: boolean;
  hasIdDocument: boolean;
}

export interface SubmissionContext {
  consentValid: boolean;
  now: Date;
  minimums: AgeMinimums;
}

/**
 * Names every mandatory item that is not yet in place (empty when the profile
 * can be submitted). A photo or ID only counts while its KYC case can still be
 * reviewed, so a failed case must be restarted and re-uploaded first.
 */
export function findMissingForSubmission(
  facts: SubmissionFacts,
  context: SubmissionContext,
): string[] {
  const missing: string[] = SUBMISSION_STEPS.filter(
    (step) => !facts.completedSteps.includes(step),
  );

  if (!missing.includes('step-1') && !passesAgeGate(facts, context)) {
    missing.push('ageGate');
  }

  if (!context.consentValid) {
    missing.push('consent');
  }

  const reviewable =
    facts.kycStatus !== null && REVIEWABLE_KYC_STATUSES.includes(facts.kycStatus);

  if (!facts.hasPhoto || !reviewable) {
    missing.push('kycPhoto');
  }

  if (!facts.hasIdDocument || !reviewable) {
    missing.push('kycId');
  }

  return missing;
}

function passesAgeGate(
  facts: SubmissionFacts,
  context: SubmissionContext,
): boolean {
  if (!facts.gender || !facts.dateOfBirth) {
    return false;
  }

  return evaluateAgeGate(
    facts.gender,
    facts.dateOfBirth,
    context.now,
    context.minimums,
  ).ok;
}
