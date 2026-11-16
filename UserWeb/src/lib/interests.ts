import type { InterestAction, InterestStatus, InterestTab } from '../types';

export const STATUS_FILTERS: ReadonlyArray<{ value: '' | InterestStatus }> = [
  { value: '' },
  { value: 'pending' },
  { value: 'accepted' },
  { value: 'declined' },
  { value: 'withdrawn' },
];

/**
 * Member-facing status word. A declined interest reads "Not accepted" to its
 * sender and "Declined" to the receiver. The backend's own `statusLabel` field
 * is deliberately not used, so the wording lives in one tested place.
 */
export function statusLabel(status: InterestStatus, viewerRole: InterestTab): string {
  switch (status) {
    case 'pending':
      return 'Pending';
    case 'accepted':
      return 'Accepted';
    case 'declined':
      return viewerRole === 'sent' ? 'Not accepted' : 'Declined';
    case 'withdrawn':
      return 'Withdrawn';
  }
}

/** Label of the filter option for a status on the given tab; empty means All. */
export function filterLabel(value: '' | InterestStatus, tab: InterestTab): string {
  return value === '' ? 'All' : statusLabel(value, tab);
}

const DAY_FORMAT = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});

function parseDate(value: unknown): Date | null {
  if (typeof value !== 'string' || value.trim() === '') return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** "14 December 2026" in UTC, or null when the value is missing or not a date. */
export function formatRetryDay(value: unknown): string | null {
  const date = parseDate(value);
  return date ? DAY_FORMAT.format(date) : null;
}

export function formatRetryDate(value: unknown): string {
  const day = formatRetryDay(value);
  return day
    ? `You can send another interest to this member on ${day}.`
    : 'You can send another interest to this member later.';
}

/** Date shown on a list item, in UTC; empty when the value is unusable. */
export function formatInterestDate(value: unknown): string {
  return formatRetryDay(value) ?? '';
}

export const CHAT_LABEL = 'You can chat once chat is available';

/** Plain text only (never a control); null when chat is not possible. */
export function chatLabel(canChat: boolean): string | null {
  return canChat ? CHAT_LABEL : null;
}

/** Actions a member may take on an item: receiver answers, sender withdraws, only while pending. */
export function allowedActions(tab: InterestTab, status: InterestStatus): InterestAction[] {
  if (status !== 'pending') return [];
  return tab === 'received' ? ['accept', 'decline'] : ['withdraw'];
}

/** Appends a page to the list, keyed by id, skipping anything already shown. */
export function mergeInterestPage<T extends { id: string }>(existing: T[], incoming: T[]): T[] {
  const seen = new Set(existing.map((item) => item.id));
  const merged = [...existing];
  for (const item of incoming) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    merged.push(item);
  }
  return merged;
}
