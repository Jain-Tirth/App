import { HttpStatus } from '@nestjs/common';

export interface ApiErrorEnvelope {
  code: string;
  message: string;
  details: unknown;
  requestId: string;
}

/**
 * A deliberate API error. The exception filter serialises it into the shared
 * `{ code, message, details, requestId }` envelope.
 */
export class ApiException extends Error {
  constructor(
    readonly status: HttpStatus,
    readonly code: string,
    message: string,
    readonly details: unknown = null,
    /** Response headers to send with the error, e.g. `Retry-After`. */
    readonly headers: Record<string, string> = {},
  ) {
    super(message);
    this.name = 'ApiException';
  }
}
