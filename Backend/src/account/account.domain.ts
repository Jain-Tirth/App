const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;

/** When a deletion requested at `requestedAt` is purged. */
export function scheduledPurgeAt(requestedAt: Date, coolingOffDays: number): Date {
  return new Date(requestedAt.getTime() + coolingOffDays * DAY_MS);
}

/** The purge boundary is inclusive: at `scheduledPurgeAt` the account is gone. */
export function isPurgeDue(scheduledAt: Date, now: Date): boolean {
  return now.getTime() >= scheduledAt.getTime();
}

/** When an export link issued at `requestedAt` stops working. */
export function exportLinkExpiry(requestedAt: Date, linkHours: number): Date {
  return new Date(requestedAt.getTime() + linkHours * HOUR_MS);
}

export function isExportExpired(expiresAt: Date, now: Date): boolean {
  return now.getTime() >= expiresAt.getTime();
}

/** The earliest failure that still counts toward the step-up limit. */
export function stepUpWindowStart(now: Date, windowMinutes: number): Date {
  return new Date(now.getTime() - windowMinutes * MINUTE_MS);
}

/**
 * Seconds until the oldest counted failure leaves the window, so a client
 * knows when to retry. Never less than one second.
 */
export function stepUpRetryAfterSeconds(
  oldestFailureAt: Date,
  now: Date,
  windowMinutes: number,
): number {
  const frees = oldestFailureAt.getTime() + windowMinutes * MINUTE_MS;

  return Math.max(1, Math.ceil((frees - now.getTime()) / 1000));
}
