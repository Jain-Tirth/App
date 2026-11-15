import type { ProfileReviewStatus } from '../types';

/** Where a member belongs for a given review status. The status always comes from GET /profiles/me. */
export function routeForStatus(status: ProfileReviewStatus): string {
  switch (status) {
    case 'draft':
      return '/register';
    case 'approved':
      return '/app';
    case 'submitted':
    case 'needsChanges':
    case 'rejected':
      return '/pending';
  }
}

export interface AllowedActions {
  submit: boolean;
  submitAgain: boolean;
  withdraw: boolean;
}

/** Which of Submit, Submit again and Withdraw a member sees for a status. */
export function allowedActions(status: ProfileReviewStatus): AllowedActions {
  return {
    submit: status === 'draft',
    submitAgain: status === 'needsChanges',
    withdraw: status === 'submitted',
  };
}

const STEP_ITEM = /^step-([1-5])$/;

/** Plain words for an item named in the `missing` list of SUBMISSION_INCOMPLETE. */
export function missingItemLabel(item: string): string {
  const step = STEP_ITEM.exec(item);
  if (step) return `Step ${step[1]} of your profile`;
  if (item === 'kycPhoto') return 'Your photo';
  if (item === 'kycId') return 'Your ID document';
  if (item === 'consent') return 'Your consent to the terms';
  return 'Another required item';
}

/**
 * Where a missing item is fixed. Consent is re-accepted through the KYC screen,
 * whose consent gate asks again when the current documents are not accepted.
 */
export function missingItemTarget(item: string): string {
  const step = STEP_ITEM.exec(item);
  if (step) return `/register?step=${step[1]}`;
  if (item === 'kycPhoto' || item === 'kycId' || item === 'consent') return '/kyc';
  return '/register';
}

/** Reads `details.missing` from a SUBMISSION_INCOMPLETE error. */
export function readMissingItems(details: unknown): string[] {
  if (!details || typeof details !== 'object' || !('missing' in details)) return [];
  const missing = (details as { missing: unknown }).missing;
  return Array.isArray(missing)
    ? missing.filter((item): item is string => typeof item === 'string')
    : [];
}
