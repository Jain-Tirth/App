import { describe, expect, it } from 'vitest';
import {
  STATUS_FILTERS,
  allowedActions,
  chatLabel,
  formatInterestDate,
  formatRetryDate,
  formatRetryDay,
  mergeInterestPage,
  statusLabel,
} from './interests';

describe('statusLabel', () => {
  it('uses the neutral wording for a declined interest seen by the sender', () => {
    expect(statusLabel('declined', 'sent')).toBe('Not accepted');
  });

  it('says Declined to the receiver', () => {
    expect(statusLabel('declined', 'received')).toBe('Declined');
  });

  it.each([
    ['pending', 'Pending'],
    ['accepted', 'Accepted'],
    ['withdrawn', 'Withdrawn'],
  ] as const)('labels %s the same for both viewers', (status, label) => {
    expect(statusLabel(status, 'sent')).toBe(label);
    expect(statusLabel(status, 'received')).toBe(label);
  });
});

describe('formatRetryDay and formatRetryDate', () => {
  it('formats the retry date in UTC', () => {
    expect(formatRetryDay('2026-12-14T00:00:00.000Z')).toBe('14 December 2026');
    expect(formatRetryDate('2026-12-14T23:59:59.000Z')).toBe(
      'You can send another interest to this member on 14 December 2026.',
    );
  });

  it('does not shift the day with the local time zone', () => {
    expect(formatRetryDay('2026-12-31T23:30:00.000Z')).toBe('31 December 2026');
  });

  it.each([undefined, null, '', 'not a date', 42, {}])('falls back for %j', (value) => {
    expect(formatRetryDay(value)).toBeNull();
    expect(formatRetryDate(value)).toBe('You can send another interest to this member later.');
  });
});

describe('formatInterestDate', () => {
  it('formats in UTC and tolerates a bad value', () => {
    expect(formatInterestDate('2026-11-16T10:00:00.000Z')).toBe('16 November 2026');
    expect(formatInterestDate('nope')).toBe('');
  });
});

describe('chatLabel', () => {
  it('shows plain text only when chat is possible', () => {
    expect(chatLabel(true)).toBe('You can chat once chat is available');
    expect(chatLabel(false)).toBeNull();
  });
});

describe('allowedActions', () => {
  it('lets the receiver accept or decline a pending interest', () => {
    expect(allowedActions('received', 'pending')).toEqual(['accept', 'decline']);
  });

  it('lets the sender withdraw a pending interest', () => {
    expect(allowedActions('sent', 'pending')).toEqual(['withdraw']);
  });

  it.each(['accepted', 'declined', 'withdrawn'] as const)('offers nothing for %s', (status) => {
    expect(allowedActions('sent', status)).toEqual([]);
    expect(allowedActions('received', status)).toEqual([]);
  });
});

describe('mergeInterestPage', () => {
  const item = (id: string) => ({ id });

  it('appends without duplicates and keeps order', () => {
    expect(mergeInterestPage([item('a'), item('b')], [item('b'), item('c')])).toEqual([
      item('a'),
      item('b'),
      item('c'),
    ]);
  });

  it('does not duplicate inside the incoming page', () => {
    expect(mergeInterestPage([], [item('a'), item('a')])).toEqual([item('a')]);
  });
});

describe('STATUS_FILTERS', () => {
  it('lists All, Pending, Accepted, declined and Withdrawn in order', () => {
    expect(STATUS_FILTERS.map((f) => f.value)).toEqual([
      '',
      'pending',
      'accepted',
      'declined',
      'withdrawn',
    ]);
  });
});
