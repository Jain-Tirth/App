import { describe, expect, it } from 'vitest';
import { ApiError } from '../apiError';
import { CODE_MESSAGES, GENERIC_MESSAGE, describeError, type ErrorContext } from './messages';

const NEW_CODES = [
  'STEP_UP_FAILED',
  'REQUEST_ALREADY_PENDING',
  'RATE_LIMITED',
  'ACCOUNT_PURGED',
  'ACCOUNT_DELETION_PENDING',
  'DELETE_REQUEST_NOT_FOUND',
  'EXPORT_EXPIRED',
  'EXPORT_NOT_FOUND',
];

const FORBIDDEN: RegExp[] = [/[{}]/, /Error:/, /HTTP/, /\b[1-5]\d{2}\b/, /[A-Z]{2,}_[A-Z_]+/, /undefined/];

function say(code: string, status: number, context: ErrorContext, details: unknown = null) {
  return describeError(new ApiError({ code, status, details, requestId: 'req-1' }), context).message;
}

describe('account story messages', () => {
  it('has an entry for every new code', () => {
    for (const code of NEW_CODES) expect(CODE_MESSAGES[code], code).toBeTypeOf('function');
  });

  it('fixes the sentences', () => {
    expect(say('STEP_UP_FAILED', 403, 'stepUp')).toBe('That password is not correct.');
    expect(say('RATE_LIMITED', 429, 'stepUp')).toBe(
      'Too many attempts. Please wait a few minutes before trying again.',
    );
    expect(say('ACCOUNT_PURGED', 410, 'generic')).toBe('This account has already been deleted.');
    expect(say('REQUEST_ALREADY_PENDING', 409, 'stepUp')).toMatch(/already have an export request/);
    expect(say('EXPORT_EXPIRED', 410, 'export')).toBe(
      'This download has expired. Request your data again.',
    );
    expect(say('EXPORT_NOT_FOUND', 404, 'export')).toBe('That download is not available.');
  });

  it('maps the export 410 and 404 by context and status when the code is generic', () => {
    expect(say('GONE', 410, 'export')).toBe('This download has expired. Request your data again.');
    expect(say('NOT_FOUND', 404, 'export')).toBe('That download is not available.');
  });

  it('gives the language field its own sentence from issues without a fields map', () => {
    const message = say('VALIDATION_ERROR', 400, 'settings', {
      issues: ['language must be one of the following values: en, hi, gu'],
    });
    expect(message).toBe('That language is not available. Please choose one from the list.');
  });

  it('stays clean for every new code in the new contexts', () => {
    for (const code of NEW_CODES) {
      for (const context of ['settings', 'stepUp', 'export', 'generic'] as ErrorContext[]) {
        for (const status of [400, 403, 404, 409, 410, 429]) {
          const text = say(code, status, context, { scheduledPurgeAt: '2026-12-17T00:00:00Z' });
          for (const pattern of FORBIDDEN) expect(pattern.test(text), `${code} ${text}`).toBe(false);
          expect(text).not.toContain('req-1');
        }
      }
    }
  });

  it('still gives the generic message for an unknown code', () => {
    expect(say('SOMETHING_NEW', 418, 'stepUp')).toBe(GENERIC_MESSAGE);
  });
});
