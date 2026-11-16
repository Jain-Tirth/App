import { describe, expect, it } from 'vitest';
import { ApiError } from '../apiError';
import {
  CODE_MESSAGES,
  CONTEXT_CODE_MESSAGES,
  GENERIC_MESSAGE,
  REQUIRED_CODES,
  describeError,
} from './messages';

const FORBIDDEN: Array<[string, RegExp]> = [
  ['curly brace', /[{}]/],
  ['Error:', /Error:/],
  ['HTTP', /HTTP/],
  ['status number', /\b[1-5]\d{2}\b/],
  ['UPPER_SNAKE code', /[A-Z]{2,}_[A-Z_]+/],
  ['undefined', /undefined/],
];

function expectClean(text: string) {
  expect(text.length).toBeGreaterThan(10);
  for (const [label, pattern] of FORBIDDEN) {
    expect(pattern.test(text), `${label} in "${text}"`).toBe(false);
  }
}

function failure(code: string, status: number, details: unknown = null): ApiError {
  return new ApiError({ code, status, details, requestId: 'req-xyz-789' });
}

const SHORTLIST_CODES = [
  'DEFAULT_SHORTLIST_PROTECTED',
  'SHORTLIST_NAME_TAKEN',
  'SHORTLIST_NOT_FOUND',
  'SHORTLIST_LIMIT_EXCEEDED',
];

describe('shortlist error messages', () => {
  it('has an explicit entry for every shortlist code and the shortlist wording overrides', () => {
    for (const code of SHORTLIST_CODES) expect(REQUIRED_CODES).toContain(code);
    expect(CONTEXT_CODE_MESSAGES['shortlists:PROFILE_NOT_FOUND']).toBeTypeOf('string');
    expect(CONTEXT_CODE_MESSAGES['shortlists:VALIDATION_ERROR']).toBeTypeOf('string');
  });

  it('keeps every shortlist sentence free of codes, braces, statuses and undefined', () => {
    for (const code of SHORTLIST_CODES) expectClean(CODE_MESSAGES[code](failure(code, 409)));
    expectClean(CONTEXT_CODE_MESSAGES['shortlists:PROFILE_NOT_FOUND']);
    expectClean(CONTEXT_CODE_MESSAGES['shortlists:VALIDATION_ERROR']);
  });

  it('fixes the sentence of each shortlist code', () => {
    expect(describeError(failure('SHORTLIST_NAME_TAKEN', 409), 'shortlists').message).toBe(
      'You already have a list with this name.',
    );
    expect(describeError(failure('DEFAULT_SHORTLIST_PROTECTED', 409), 'shortlists').message).toBe(
      'Your Shortlisted list is always kept, so it cannot be renamed or deleted. You can create another list instead.',
    );
    expect(describeError(failure('SHORTLIST_NOT_FOUND', 404), 'shortlists').message).toBe(
      'That list is no longer available. We have refreshed your lists, so please choose one and try again.',
    );
    expect(describeError(failure('SHORTLIST_LIMIT_EXCEEDED', 409), 'shortlists').message).toBe(
      'You have reached the limit for your shortlists. Please remove a profile or a list you no longer need and try again.',
    );
    expect(describeError(failure('PROFILE_NOT_FOUND', 404), 'shortlists').message).toBe(
      "This profile isn't available, so it cannot be added to a shortlist.",
    );
  });

  it('puts a duplicate name on the name field', () => {
    const result = describeError(failure('SHORTLIST_NAME_TAKEN', 409), 'shortlists');
    expect(result.fields).toEqual({ name: 'You already have a list with this name.' });
  });

  it('maps a server name validation error from details.issues to the friendly sentences', () => {
    const empty = describeError(
      failure('VALIDATION_ERROR', 400, { issues: ['name must be longer than or equal to 1 characters'] }),
      'shortlists',
    );
    expect(empty.fields).toEqual({ name: 'Enter a name for your list.' });
    expect(empty.message).toBe('Enter a name for your list.');

    const long = describeError(
      failure('VALIDATION_ERROR', 400, { issues: ['name must be shorter than or equal to 100 characters'] }),
      'shortlists',
    );
    expect(long.fields).toEqual({ name: 'Use 100 characters or fewer.' });
    expect(JSON.stringify(long)).not.toContain('must be');
  });

  it('uses the general shortlist sentence when no name field is named', () => {
    const result = describeError(failure('VALIDATION_ERROR', 400, { issues: ['other is wrong'] }), 'shortlists');
    expect(result.fields).toEqual({});
    expect(result.message).toBe('That list name could not be used. Please check it and try again.');
  });

  it('still gives an unknown code the generic message without leaking anything', () => {
    const result = describeError(
      new ApiError({ code: 'SHORTLIST_SOMETHING_NEW', status: 418, requestId: 'req-leak-1' }),
      'shortlists',
    );
    expect(result.message).toBe(GENERIC_MESSAGE);
    expect(result.message).not.toContain('SHORTLIST_SOMETHING_NEW');
    expect(result.message).not.toContain('req-leak-1');
  });
});
