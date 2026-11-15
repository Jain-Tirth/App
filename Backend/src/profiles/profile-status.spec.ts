import {
  PROFILE_EVENTS,
  PROFILE_REVIEW_STATUSES,
  transitionProfileStatus,
  type ProfileEvent,
  type ProfileReviewStatus,
} from './profile-status';

type Allowed = [ProfileReviewStatus, ProfileEvent, ProfileReviewStatus, string];

// Every allowed pair, written out from the spec (story 5 Task, Transitions).
const ALLOWED: Allowed[] = [
  ['draft', 'submit', 'submitted', 'pending'],
  ['submitted', 'withdraw', 'draft', 'pending'],
  ['submitted', 'approve', 'approved', 'active'],
  ['submitted', 'requestChanges', 'needsChanges', 'pending'],
  ['submitted', 'reject', 'rejected', 'rejected'],
  ['needsChanges', 'submit', 'submitted', 'pending'],
  ['rejected', 'reopen', 'needsChanges', 'pending'],
];

describe('transitionProfileStatus', () => {
  it('covers five states and six events', () => {
    expect(PROFILE_REVIEW_STATUSES).toHaveLength(5);
    expect(PROFILE_EVENTS).toHaveLength(6);
  });

  it.each(ALLOWED)('%s + %s -> %s with account status %s', (from, event, to, account) => {
    expect(transitionProfileStatus(from, event, 'pending')).toEqual({
      ok: true,
      status: to,
      accountStatus: account,
    });
  });

  const disallowed: [ProfileReviewStatus, ProfileEvent][] = [];
  for (const status of PROFILE_REVIEW_STATUSES) {
    for (const event of PROFILE_EVENTS) {
      if (!ALLOWED.some(([from, ev]) => from === status && ev === event)) {
        disallowed.push([status, event]);
      }
    }
  }

  it('has 23 disallowed pairs (30 pairs minus 7 allowed)', () => {
    expect(disallowed).toHaveLength(23);
  });

  it.each(disallowed)('%s + %s is refused', (from, event) => {
    expect(transitionProfileStatus(from, event, 'pending')).toEqual({ ok: false });
  });

  it.each(ALLOWED)('leaves a blocked account blocked for %s + %s', (from, event, to) => {
    expect(transitionProfileStatus(from, event, 'blocked')).toEqual({
      ok: true,
      status: to,
      accountStatus: 'blocked',
    });
  });
});
