import { describe, expect, it } from 'vitest';
import { AdminApiError } from './adminApiError';
import { GENERIC_MESSAGE, REOPEN_ERROR_MESSAGES, describeReopenError } from './messages';

const FORBIDDEN_PATTERNS: Array<[string, RegExp]> = [
  ['curly brace', /[{}]/],
  ['Error:', /Error:/],
  ['HTTP', /HTTP/],
  ['status number', /\b[1-5]\d{2}\b/],
  ['UPPER_SNAKE code', /[A-Z]{2,}_[A-Z_]+/],
  ['undefined', /undefined/],
];

function expectClean(text: string) {
  expect(text.length).toBeGreaterThan(10);
  for (const [label, pattern] of FORBIDDEN_PATTERNS) {
    expect(pattern.test(text), `${label} in "${text}"`).toBe(false);
  }
}

const REQUIRED_CODES = [
  'INVALID_STATUS_TRANSITION',
  'INVALID_REASON_CODE',
  'NOT_FOUND',
  'UNAUTHORIZED',
  'FORBIDDEN',
  'RATE_LIMITED',
  'INTERNAL_ERROR',
  'NETWORK_ERROR',
  'TIMEOUT',
  'NON_JSON_RESPONSE',
];

describe('reopen error messages', () => {
  it('has an entry for every code of the reopen call', () => {
    for (const code of REQUIRED_CODES) {
      expect(REOPEN_ERROR_MESSAGES[code], code).toBeTypeOf('string');
    }
  });

  it('maps a status change to the fixed sentence', () => {
    expect(describeReopenError(new AdminApiError({ code: 'INVALID_STATUS_TRANSITION', status: 409 }))).toBe(
      'This profile can no longer be reopened because its status has changed.',
    );
  });

  it('keeps every message free of braces, codes, status numbers and raw text', () => {
    for (const text of Object.values(REOPEN_ERROR_MESSAGES)) expectClean(text);
    for (const status of [0, 400, 401, 403, 404, 409, 429, 500]) {
      for (const code of [...REQUIRED_CODES, 'VALIDATION_ERROR', 'SOMETHING_NEW']) {
        expectClean(describeReopenError(new AdminApiError({ code, status })));
      }
    }
    expectClean(GENERIC_MESSAGE);
  });

  it('answers an unknown code or a foreign error with the generic message only', () => {
    expect(describeReopenError(new AdminApiError({ code: 'WEIRD_CODE', status: 418 }))).toBe(GENERIC_MESSAGE);
    expect(describeReopenError(new Error('boom {"x":1}'))).toBe(GENERIC_MESSAGE);
    expect(describeReopenError('text')).toBe(GENERIC_MESSAGE);
  });
});
