import {
  assertWithinDailySendLimit,
  canChat,
  cooldownEndsAt,
  decideTransition,
  isCooldownActive,
} from './interest.domain';
import { INTEREST_STATUSES } from './interest.types';

describe('interest state transitions', () => {
  it.each([
    ['accept', 'pending', 'accepted', true],
    ['accept', 'accepted', 'accepted', false],
    ['decline', 'pending', 'declined', true],
    ['decline', 'declined', 'declined', false],
    ['withdraw', 'pending', 'withdrawn', true],
  ] as const)('%s from %s gives %s (changed: %s)', (action, from, to, changed) => {
    expect(decideTransition(from, action)).toEqual({ to, changed });
  });

  it.each([
    ['accept', 'declined'],
    ['accept', 'withdrawn'],
    ['decline', 'accepted'],
    ['decline', 'withdrawn'],
    ['withdraw', 'accepted'],
    ['withdraw', 'declined'],
    ['withdraw', 'withdrawn'],
  ] as const)('%s from %s is not allowed', (action, from) => {
    expect(decideTransition(from, action)).toBeNull();
  });
});

describe('canChat', () => {
  it('is true only for accepted', () => {
    expect(INTEREST_STATUSES.filter((status) => canChat(status))).toEqual([
      'accepted',
    ]);
  });
});

describe('resend cooldown', () => {
  const declinedAt = new Date('2026-10-01T10:00:00.000Z');
  const dayAfter = (days: number) =>
    new Date(declinedAt.getTime() + days * 24 * 60 * 60 * 1000);

  it('is blocked on day 29 and allowed on day 30', () => {
    expect(isCooldownActive(declinedAt, 30, dayAfter(29))).toBe(true);
    expect(isCooldownActive(declinedAt, 30, dayAfter(30))).toBe(false);
  });

  it('reports the end of the cooldown', () => {
    expect(cooldownEndsAt(declinedAt, 30).toISOString()).toBe(
      '2026-10-31T10:00:00.000Z',
    );
  });

  it('is inactive when there was no decline', () => {
    expect(isCooldownActive(null, 30, declinedAt)).toBe(false);
  });
});

describe('daily send limit', () => {
  it('allows 3 sends and rejects the 4th when the limit is 3', () => {
    for (const sentToday of [0, 1, 2]) {
      expect(() => assertWithinDailySendLimit(3, sentToday)).not.toThrow();
    }

    expect(() => assertWithinDailySendLimit(3, 3)).toThrow(
      expect.objectContaining({ status: 429, code: 'RATE_LIMITED' }),
    );
  });

  it('never limits when unset', () => {
    expect(() => assertWithinDailySendLimit(null, 100000)).not.toThrow();
  });
});
