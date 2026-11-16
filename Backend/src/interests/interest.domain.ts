import { HttpStatus } from '@nestjs/common';
import { ApiException } from '../common/api-error';
import type {
  InterestAction,
  InterestStatus,
  TransitionDecision,
} from './interest.types';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The state machine. Accept and decline are idempotent on their own terminal
 * state; every other combination outside `pending` is invalid.
 */
const TRANSITIONS: Record<
  InterestAction,
  Partial<Record<InterestStatus, TransitionDecision>>
> = {
  accept: {
    pending: { to: 'accepted', changed: true },
    accepted: { to: 'accepted', changed: false },
  },
  decline: {
    pending: { to: 'declined', changed: true },
    declined: { to: 'declined', changed: false },
  },
  withdraw: {
    pending: { to: 'withdrawn', changed: true },
  },
};

/** Returns the transition, or `null` when the action is not allowed from `from`. */
export function decideTransition(
  from: InterestStatus,
  action: InterestAction,
): TransitionDecision | null {
  return TRANSITIONS[action][from] ?? null;
}

/** Chat is possible only on an accepted interest; derived, never stored. */
export function canChat(status: InterestStatus): boolean {
  return status === 'accepted';
}

/** When the sender may send to the same receiver again after a decline. */
export function cooldownEndsAt(declinedAt: Date, days: number): Date {
  return new Date(declinedAt.getTime() + days * DAY_MS);
}

export function isCooldownActive(
  declinedAt: Date | null,
  days: number,
  now: Date,
): boolean {
  return declinedAt !== null && now.getTime() < cooldownEndsAt(declinedAt, days).getTime();
}

/**
 * Daily send limit. `null` (unset in configuration) means unlimited; a limit of
 * N allows N sends per UTC day and rejects send N+1.
 */
export function assertWithinDailySendLimit(
  limit: number | null,
  sentToday: number,
): void {
  if (limit === null || sentToday < limit) {
    return;
  }

  throw new ApiException(
    HttpStatus.TOO_MANY_REQUESTS,
    'RATE_LIMITED',
    'You have reached the daily limit for sending interests.',
    { limit },
  );
}
