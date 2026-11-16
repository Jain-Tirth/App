import { AdminApiError } from './adminApiError';

/**
 * Turns an error from the reopen call into a short, plain sentence. Nothing here
 * is ever a raw code, a JSON body, an HTTP status or the API's `message` field.
 * Only the reopen call uses this module; other calls are unchanged.
 */
export const GENERIC_MESSAGE = 'Something went wrong. Please try again in a moment.';

const CHOOSE_REASON = 'Choose a reason from the list and keep the notes short, then try again.';

/** One entry per code the reopen call can produce. */
export const REOPEN_ERROR_MESSAGES: Record<string, string> = {
  INVALID_STATUS_TRANSITION:
    'This profile can no longer be reopened because its status has changed.',
  INVALID_REASON_CODE: CHOOSE_REASON,
  // The backend reports an unknown reason code or over-long notes as a validation error.
  VALIDATION_ERROR: CHOOSE_REASON,
  NOT_FOUND: 'We could not find this member. Please go back to the dashboard and try again.',
  UNAUTHORIZED: 'Your session has expired. Please sign in again.',
  FORBIDDEN: 'You do not have permission to reopen profiles.',
  RATE_LIMITED: 'Too many requests. Please wait a moment and try again.',
  INTERNAL_ERROR: 'Something went wrong on our side. Please try again in a moment.',
  NETWORK_ERROR: 'We could not reach the server. Please check your connection and try again.',
  TIMEOUT: 'That is taking too long. Please try again.',
  NON_JSON_RESPONSE: GENERIC_MESSAGE,
};

export function describeReopenError(error: unknown): string {
  if (!(error instanceof AdminApiError)) return GENERIC_MESSAGE;
  return REOPEN_ERROR_MESSAGES[error.code] ?? GENERIC_MESSAGE;
}

const CHOOSE_COOLDOWN_REASON =
  'Choose a reason from the list, check both profile IDs and keep the notes short, then try again.';

/** One entry per code the Clear cooldown call can produce. */
export const CLEAR_COOLDOWN_ERROR_MESSAGES: Record<string, string> = {
  COOLDOWN_NOT_FOUND: 'There is no active cooldown for this pair.',
  INVALID_REASON_CODE: CHOOSE_COOLDOWN_REASON,
  VALIDATION_ERROR: CHOOSE_COOLDOWN_REASON,
  UNAUTHORIZED: 'Your session has expired. Please sign in again.',
  FORBIDDEN: 'You do not have permission to clear cooldowns.',
  RATE_LIMITED: 'Too many requests. Please wait a moment and try again.',
  INTERNAL_ERROR: 'Something went wrong on our side. Please try again in a moment.',
  NETWORK_ERROR: 'We could not reach the server. Please check your connection and try again.',
  TIMEOUT: 'That is taking too long. Please try again.',
  NON_JSON_RESPONSE: GENERIC_MESSAGE,
};

export function describeClearCooldownError(error: unknown): string {
  if (!(error instanceof AdminApiError)) return GENERIC_MESSAGE;
  return CLEAR_COOLDOWN_ERROR_MESSAGES[error.code] ?? GENERIC_MESSAGE;
}
