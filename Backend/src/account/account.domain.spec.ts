import {
  exportLinkExpiry,
  isExportExpired,
  isPurgeDue,
  scheduledPurgeAt,
  stepUpRetryAfterSeconds,
  stepUpWindowStart,
} from './account.domain';

describe('account domain arithmetic', () => {
  const requested = new Date('2026-11-16T10:00:00.000Z');

  it('schedules the purge 30 days after the request', () => {
    expect(scheduledPurgeAt(requested, 30).toISOString()).toBe(
      '2026-12-16T10:00:00.000Z',
    );
  });

  it('honours a configured cooling-off', () => {
    expect(scheduledPurgeAt(requested, 7).toISOString()).toBe(
      '2026-11-23T10:00:00.000Z',
    );
  });

  it('is not due the day before the boundary and is due at it', () => {
    const boundary = scheduledPurgeAt(requested, 30);

    expect(isPurgeDue(boundary, new Date('2026-12-15T10:00:00.000Z'))).toBe(false);
    expect(isPurgeDue(boundary, new Date('2026-12-16T09:59:59.999Z'))).toBe(false);
    expect(isPurgeDue(boundary, new Date('2026-12-16T10:00:00.000Z'))).toBe(true);
    expect(isPurgeDue(boundary, new Date('2026-12-17T10:00:00.000Z'))).toBe(true);
  });

  it('expires an export link after 24 hours', () => {
    const expiry = exportLinkExpiry(requested, 24);

    expect(expiry.toISOString()).toBe('2026-11-17T10:00:00.000Z');
    expect(isExportExpired(expiry, new Date('2026-11-17T09:59:59.999Z'))).toBe(false);
    expect(isExportExpired(expiry, new Date('2026-11-17T10:00:00.000Z'))).toBe(true);
  });

  it('counts step-up failures over the last 15 minutes', () => {
    expect(stepUpWindowStart(requested, 15).toISOString()).toBe(
      '2026-11-16T09:45:00.000Z',
    );
  });

  it('tells the client when the oldest counted failure leaves the window', () => {
    const oldest = new Date('2026-11-16T09:50:00.000Z');

    expect(stepUpRetryAfterSeconds(oldest, requested, 15)).toBe(300);
    expect(
      stepUpRetryAfterSeconds(oldest, new Date('2026-11-16T10:06:00.000Z'), 15),
    ).toBe(1);
  });
});
