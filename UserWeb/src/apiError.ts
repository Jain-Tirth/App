/**
 * The one error type thrown by the UserWeb API client. It carries structured
 * data only; pages never render any of its fields directly. They pass it to
 * `describeError` in `errors/messages.ts`, which is the only place that turns
 * an error into text a member can read.
 */
export type SyntheticErrorCode = 'NETWORK_ERROR' | 'TIMEOUT' | 'NON_JSON_RESPONSE';

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details: unknown;
  /** Seconds from the Retry-After header, or null when absent. */
  readonly retryAfter: number | null;
  readonly requestId: string | null;

  constructor(init: {
    code: string;
    status: number;
    details?: unknown;
    retryAfter?: number | null;
    requestId?: string | null;
  }) {
    super('Request failed');
    this.name = 'ApiError';
    this.code = init.code;
    this.status = init.status;
    this.details = init.details ?? null;
    this.retryAfter = init.retryAfter ?? null;
    this.requestId = init.requestId ?? null;
  }
}

export function isApiError(value: unknown): value is ApiError {
  return value instanceof ApiError;
}

export function hasErrorCode(value: unknown, ...codes: string[]): boolean {
  return isApiError(value) && codes.includes(value.code);
}
