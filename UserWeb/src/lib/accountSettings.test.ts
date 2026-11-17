import { describe, expect, it } from 'vitest';
import {
  DELETION_COOLING_OFF_DAYS,
  diffSettings,
  formatPurgeDate,
  humanizeFlag,
  pickEditable,
  readScheduledPurgeAt,
} from './accountSettings';

describe('humanizeFlag', () => {
  it.each([
    ['interestReceived', 'Interest received'],
    ['profileApproved', 'Profile approved'],
    ['newMessage', 'New message'],
    ['profile_viewed', 'Profile viewed'],
    ['x', 'X'],
    ['', ''],
  ])('%s -> %s', (key, label) => {
    expect(humanizeFlag(key)).toBe(label);
  });
});

describe('formatPurgeDate', () => {
  it('formats in UTC', () => {
    expect(formatPurgeDate('2026-12-17T23:30:00.000Z')).toBe('17 December 2026');
  });
  it('falls back for junk', () => {
    expect(formatPurgeDate(null)).toBe('the scheduled date');
    expect(formatPurgeDate('nope')).toBe('the scheduled date');
  });
  it('mirrors the backend default of 30 days', () => {
    expect(DELETION_COOLING_OFF_DAYS).toBe(30);
  });
  it('reads scheduledPurgeAt from error details', () => {
    expect(readScheduledPurgeAt({ scheduledPurgeAt: '2026-12-17T00:00:00.000Z' })).toBe(
      '2026-12-17T00:00:00.000Z',
    );
    expect(readScheduledPurgeAt(null)).toBeNull();
    expect(readScheduledPurgeAt({ scheduledPurgeAt: 5 })).toBeNull();
  });
});

describe('settings patch diff', () => {
  const server = {
    language: 'en',
    profileVisibility: 'hidden',
    notifications: { interestReceived: true, newMessage: false },
  };
  const before = pickEditable(server);

  it('ignores profileVisibility from the server', () => {
    expect(before).toEqual({
      language: 'en',
      notifications: { interestReceived: true, newMessage: false },
    });
    expect(JSON.stringify(before)).not.toContain('rofileVisibility');
  });

  it('sends nothing when nothing changed', () => {
    expect(diffSettings(before, pickEditable(server))).toEqual({});
  });

  it('sends only the changed language', () => {
    expect(diffSettings(before, { ...before, language: 'gu' })).toEqual({ language: 'gu' });
  });

  it('sends only the changed notification key', () => {
    const next = { ...before, notifications: { ...before.notifications, newMessage: true } };
    expect(diffSettings(before, next)).toEqual({ notifications: { newMessage: true } });
  });

  it('never carries profileVisibility, even if the input has it', () => {
    const polluted = { ...before, profileVisibility: 'all', language: 'hi' } as never;
    const patch = diffSettings(before, polluted);
    expect(patch).toEqual({ language: 'hi' });
    expect('profileVisibility' in patch).toBe(false);
  });
});
