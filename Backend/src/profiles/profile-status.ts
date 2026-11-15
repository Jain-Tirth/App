export const PROFILE_REVIEW_STATUSES = [
  'draft',
  'submitted',
  'approved',
  'needsChanges',
  'rejected',
] as const;
export type ProfileReviewStatus = (typeof PROFILE_REVIEW_STATUSES)[number];

export const PROFILE_EVENTS = [
  'submit',
  'withdraw',
  'approve',
  'requestChanges',
  'reject',
  'reopen',
] as const;
export type ProfileEvent = (typeof PROFILE_EVENTS)[number];

export type ProfileAccountStatus = 'pending' | 'active' | 'rejected' | 'blocked';

const TRANSITIONS: Record<
  ProfileEvent,
  Partial<Record<ProfileReviewStatus, ProfileReviewStatus>>
> = {
  submit: { draft: 'submitted', needsChanges: 'submitted' },
  withdraw: { submitted: 'draft' },
  approve: { submitted: 'approved' },
  requestChanges: { submitted: 'needsChanges' },
  reject: { submitted: 'rejected' },
  reopen: { rejected: 'needsChanges' },
};

const ACCOUNT_STATUS_BY_REVIEW: Record<
  ProfileReviewStatus,
  Exclude<ProfileAccountStatus, 'blocked'>
> = {
  draft: 'pending',
  submitted: 'pending',
  approved: 'active',
  needsChanges: 'pending',
  rejected: 'rejected',
};

export type ProfileTransition =
  | {
      ok: true;
      status: ProfileReviewStatus;
      accountStatus: ProfileAccountStatus;
    }
  | { ok: false };

/**
 * The only function that decides a member's review status. It also derives the
 * matching `accountStatus` so the two columns never disagree; a blocked account
 * stays blocked. Idempotent re-submission is handled by the caller, not here.
 */
export function transitionProfileStatus(
  current: ProfileReviewStatus,
  event: ProfileEvent,
  accountStatus: ProfileAccountStatus,
): ProfileTransition {
  const next = TRANSITIONS[event][current];

  if (!next) {
    return { ok: false };
  }

  return {
    ok: true,
    status: next,
    accountStatus:
      accountStatus === 'blocked' ? 'blocked' : ACCOUNT_STATUS_BY_REVIEW[next],
  };
}
