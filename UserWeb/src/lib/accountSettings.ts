import { formatRetryDay } from './interests';

/** Mirrors the backend default ACCOUNT_DELETION_COOLING_OFF_DAYS. */
export const DELETION_COOLING_OFF_DAYS = 30;

export const NO_THIRD_PARTY_TEXT = 'Your data is not shared with third parties.';

export type SettingsLanguage = 'en' | 'hi' | 'gu';

export const LANGUAGE_OPTIONS: ReadonlyArray<{ value: SettingsLanguage; label: string }> = [
  { value: 'en', label: 'English' },
  { value: 'hi', label: 'Hindi' },
  { value: 'gu', label: 'Gujarati' },
];

export interface EditableSettings {
  language: SettingsLanguage;
  notifications: Record<string, boolean>;
}

export interface SettingsPatch {
  language?: SettingsLanguage;
  notifications?: Record<string, boolean>;
}

/** "interestReceived" becomes "Interest received". */
export function humanizeFlag(key: string): string {
  const words = key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim()
    .toLowerCase();
  if (words === '') return '';
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * Keeps only what the editable controls show. Anything else in the server
 * response, profileVisibility included, is dropped here and never sent back.
 */
export function pickEditable(source: {
  language?: unknown;
  notifications?: unknown;
}): EditableSettings {
  const language: SettingsLanguage =
    source.language === 'hi' || source.language === 'gu' ? source.language : 'en';
  const notifications: Record<string, boolean> = {};
  if (source.notifications && typeof source.notifications === 'object') {
    for (const [key, value] of Object.entries(source.notifications)) {
      if (typeof value === 'boolean') notifications[key] = value;
    }
  }
  return { language, notifications };
}

/** The PATCH body for a change: only the keys that differ. Empty when nothing changed. */
export function diffSettings(before: EditableSettings, after: EditableSettings): SettingsPatch {
  const patch: SettingsPatch = {};
  if (before.language !== after.language) patch.language = after.language;
  const changed: Record<string, boolean> = {};
  for (const [key, value] of Object.entries(after.notifications)) {
    if (before.notifications[key] !== value) changed[key] = value;
  }
  if (Object.keys(changed).length > 0) patch.notifications = changed;
  return patch;
}

/** "14 December 2026" (UTC), or a plain fallback when the value is unusable. */
export function formatPurgeDate(value: unknown): string {
  return formatRetryDay(value) ?? 'the scheduled date';
}

/** Reads details.scheduledPurgeAt from an ACCOUNT_DELETION_PENDING error. */
export function readScheduledPurgeAt(details: unknown): string | null {
  if (details && typeof details === 'object' && 'scheduledPurgeAt' in details) {
    const value = (details as { scheduledPurgeAt: unknown }).scheduledPurgeAt;
    if (typeof value === 'string') return value;
  }
  return null;
}
