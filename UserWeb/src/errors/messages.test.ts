import { describe, expect, it } from 'vitest';
import { ApiError } from '../apiError';
import {
  CODE_MESSAGES,
  CONTEXT_CODE_MESSAGES,
  CONTEXT_STATUS_MESSAGES,
  FIELD_MESSAGES,
  GENERIC_MESSAGE,
  REQUIRED_CODES,
  describeError,
  formatWait,
  type ErrorContext,
} from './messages';

const CONTEXTS: ErrorContext[] = [
  'register',
  'otpSend',
  'otpVerify',
  'login',
  'refresh',
  'profile',
  'step',
  'consents',
  'kyc',
  'kycUpload',
  'kycRestart',
  'storage',
  'matches',
  'discovery',
  'submit',
  'withdraw',
  'generic',
];

function sample(code: string, status = 400): ApiError {
  return new ApiError({
    code,
    status,
    details: { minimumAge: 21, issues: ['email must be an email'] },
    retryAfter: 5400,
    requestId: 'req-abc-123',
  });
}

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

describe('error message table', () => {
  it('has an entry for every code a member can receive', () => {
    for (const code of REQUIRED_CODES) {
      expect(CODE_MESSAGES[code], code).toBeTypeOf('function');
    }
    expect(REQUIRED_CODES).toEqual(
      expect.arrayContaining([
        'VALIDATION_ERROR',
        'AGE_BELOW_MINIMUM',
        'INVALID_DATE_OF_BIRTH',
        'CONSENT_REQUIRED',
        'CONSENT_DOCUMENT_MISMATCH',
        'VERIFICATION_ALREADY_EXISTS',
        'VERIFICATION_NOT_FOUND',
        'MEDIA_NOT_FOUND',
        'FILE_TOO_LARGE',
        'FILE_TYPE_NOT_ALLOWED',
        'FILE_TYPE_NOT_ALLOWED_FOR_PURPOSE',
        'SIZE_MISMATCH',
        'CHECKSUM_MISMATCH',
        'FILE_CONTENT_MISMATCH',
        'UPLOAD_NOT_FOUND',
        'MEDIA_ALREADY_ATTACHED',
        'RESTART_LIMIT_REACHED',
        'INVALID_STATUS_TRANSITION',
        'PROFILE_NOT_APPROVED',
        'SUBMISSION_INCOMPLETE',
        'PROFILE_LOCKED_IN_REVIEW',
        'USER_EXISTS',
        'BAD_REQUEST',
        'UNAUTHORIZED',
        'FORBIDDEN',
        'NOT_FOUND',
        'CONFLICT',
        'UNPROCESSABLE_ENTITY',
        'RATE_LIMITED',
        'INTERNAL_ERROR',
        'HTTP_ERROR',
        'NETWORK_ERROR',
        'TIMEOUT',
        'NON_JSON_RESPONSE',
      ]),
    );
  });

  it('produces clean text for every code entry', () => {
    for (const [code, build] of Object.entries(CODE_MESSAGES)) {
      expectClean(build(sample(code)));
      expectClean(build(new ApiError({ code, status: 400 })));
    }
  });

  it('fixes the wording of the submission and withdrawal codes', () => {
    expect(describeError(sample('SUBMISSION_INCOMPLETE', 422), 'submit').message).toBe(
      'Your profile is not complete yet. Please finish the items listed below and submit again.',
    );
    expect(describeError(sample('PROFILE_LOCKED_IN_REVIEW', 409), 'step').message).toBe(
      'Your profile is being reviewed, so it cannot be edited right now. Choose "Withdraw to edit" on your status page if you need to make changes.',
    );
    expect(describeError(sample('INVALID_STATUS_TRANSITION', 409), 'submit').message).toBe(
      'Your profile cannot be submitted right now because its status has changed. Please refresh to see where it stands.',
    );
    expect(describeError(sample('INVALID_STATUS_TRANSITION', 409), 'withdraw').message).toBe(
      'Your profile can no longer be withdrawn because its review has already moved on. Please refresh to see the latest status.',
    );
    expect(describeError(sample('PROFILE_NOT_APPROVED', 403), 'submit').message).toBe(
      'Your profile has not been approved yet, so this is not available. You can follow its progress on your status page.',
    );
    expect(describeError(sample('PROFILE_NOT_APPROVED', 403), 'withdraw').message).toBe(
      'Your profile has not been approved yet, so this is not available. You can follow its progress on your status page.',
    );
  });

  it('produces clean text for every context and status entry and field message', () => {
    for (const text of Object.values(CONTEXT_CODE_MESSAGES)) expectClean(text);
    for (const text of Object.values(CONTEXT_STATUS_MESSAGES)) expectClean(text);
    for (const text of Object.values(FIELD_MESSAGES)) expectClean(text);
    expectClean(GENERIC_MESSAGE);
  });

  it('produces clean text for every code in every context and status', () => {
    for (const ctx of CONTEXTS) {
      for (const status of [0, 400, 401, 403, 404, 409, 422, 429, 500, 503]) {
        for (const code of REQUIRED_CODES) {
          const friendly = describeError(sample(code, status), ctx);
          expectClean(friendly.message);
          for (const text of Object.values(friendly.fields)) expectClean(text);
        }
      }
    }
  });
});

describe('describeError fallbacks', () => {
  it('uses the generic message for an unknown code without leaking it', () => {
    const friendly = describeError(
      new ApiError({ code: 'WEIRD_NEW_CODE', status: 418, requestId: 'req-zzz-999' }),
      'generic',
    );
    expect(friendly.message).toBe(GENERIC_MESSAGE);
    expect(friendly.message).not.toContain('WEIRD');
    expect(friendly.message).not.toContain('req-zzz-999');
    expect(friendly.reference).toBe('req-zzz-999');
  });

  it('uses the generic message for a non-JSON or HTML body', () => {
    const friendly = describeError(
      new ApiError({ code: 'NON_JSON_RESPONSE', status: 502, requestId: 'req-html-1' }),
      'login',
    );
    expect(friendly.message).toBe(GENERIC_MESSAGE);
  });

  it('gives a friendly, leak-free message for a network failure', () => {
    const friendly = describeError(new ApiError({ code: 'NETWORK_ERROR', status: 0 }), 'login');
    expectClean(friendly.message);
    expect(friendly.message).toMatch(/connection/i);
  });

  it('gives the generic message for non-ApiError values and never their text', () => {
    const friendly = describeError(new Error('TypeError: x is undefined at foo.js:12'), 'generic');
    expect(friendly.message).toBe(GENERIC_MESSAGE);
    expect(describeError('boom {"code":"X"}', 'generic').message).toBe(GENERIC_MESSAGE);
    expect(describeError(undefined, 'generic').message).toBe(GENERIC_MESSAGE);
  });

  it('never puts the server message text in the output', () => {
    const err = new ApiError({ code: 'BAD_REQUEST', status: 400, details: null });
    Object.defineProperty(err, 'message', { value: 'Invalid OTP.' });
    expect(describeError(err, 'otpVerify').message).not.toContain('Invalid OTP.');
  });

  it('keeps the request id out of the message', () => {
    const friendly = describeError(sample('CONFLICT', 409), 'register');
    expect(friendly.message).not.toContain('req-abc-123');
    expect(friendly.reference).toBe('req-abc-123');
  });
});

describe('context-keyed messages', () => {
  it('maps login 401 to wrong email or password', () => {
    const m = describeError(new ApiError({ code: 'UNAUTHORIZED', status: 401 }), 'login').message;
    expect(m).toMatch(/email or password is incorrect/i);
  });

  it('maps login 403 to one combined sentence with a support pointer', () => {
    const m = describeError(new ApiError({ code: 'FORBIDDEN', status: 403 }), 'login').message;
    expect(m).toMatch(/contact support/i);
  });

  it('maps otp verify 400 to an invalid code message and otp 401 to request a new code', () => {
    expect(
      describeError(new ApiError({ code: 'BAD_REQUEST', status: 400 }), 'otpVerify').message,
    ).toMatch(/code is not correct/i);
    expect(
      describeError(new ApiError({ code: 'UNAUTHORIZED', status: 401 }), 'otpVerify').message,
    ).toMatch(/request a new code/i);
  });

  it('maps refresh 401 and a session 401 to sign in again', () => {
    expect(
      describeError(new ApiError({ code: 'UNAUTHORIZED', status: 401 }), 'refresh').message,
    ).toMatch(/sign in again/i);
    expect(
      describeError(new ApiError({ code: 'UNAUTHORIZED', status: 401 }), 'kyc').message,
    ).toMatch(/sign in again/i);
  });

  it('keeps register 409 enumeration-safe', () => {
    const m = describeError(new ApiError({ code: 'CONFLICT', status: 409 }), 'register').message;
    expect(m).not.toMatch(/email (is )?(already )?(taken|registered|exists)/i);
    expect(m).not.toMatch(/mobile (number )?(is )?(already )?(taken|registered|exists)/i);
    expect(describeError(sample('USER_EXISTS', 409), 'register').message).toBe(m);
  });

  it('maps 429 and 5xx', () => {
    expect(
      describeError(new ApiError({ code: 'RATE_LIMITED', status: 429 }), 'login').message,
    ).toMatch(/too many attempts/i);
    expect(
      describeError(new ApiError({ code: 'INTERNAL_ERROR', status: 500 }), 'login').message,
    ).toMatch(/our side/i);
  });
});

describe('specific codes', () => {
  it('uses minimumAge for AGE_BELOW_MINIMUM', () => {
    const m = describeError(
      new ApiError({ code: 'AGE_BELOW_MINIMUM', status: 400, details: { minimumAge: 21 } }),
      'step',
    ).message;
    expect(m).toContain('21');
    const f = describeError(
      new ApiError({ code: 'AGE_BELOW_MINIMUM', status: 400, details: { minimumAge: 18 } }),
      'step',
    );
    expect(f.message).toContain('18');
    expect(f.fields.dateOfBirth).toContain('18');
  });

  it('puts INVALID_DATE_OF_BIRTH on the date field', () => {
    const f = describeError(new ApiError({ code: 'INVALID_DATE_OF_BIRTH', status: 400 }), 'step');
    expect(f.fields.dateOfBirth).toMatch(/not in the future/i);
  });

  it('builds field-level messages from validation issues', () => {
    const f = describeError(
      new ApiError({
        code: 'VALIDATION_ERROR',
        status: 400,
        details: { issues: ['email must be an email', 'password must be longer than or equal to 8 characters'] },
      }),
      'register',
    );
    expect(f.fields.email).toMatch(/valid email/i);
    expect(f.fields.password).toMatch(/8 to 20/);
  });

  it('falls back to a form-level sentence for unmapped issues', () => {
    const f = describeError(
      new ApiError({
        code: 'VALIDATION_ERROR',
        status: 400,
        details: { issues: ['somethingElse is broken'] },
      }),
      'register',
    );
    expect(f.fields).toEqual({});
    expect(f.message).toMatch(/check/i);
    expectClean(f.message);
  });

  it('formats the restart wait in minutes or hours and minutes', () => {
    expect(formatWait(30)).toBe('1 minute');
    expect(formatWait(300)).toBe('5 minutes');
    expect(formatWait(3600)).toBe('1 hour');
    expect(formatWait(5400)).toBe('1 hour and 30 minutes');
    expect(formatWait(7200 + 60)).toBe('2 hours and 1 minute');
    const m = describeError(
      new ApiError({ code: 'RESTART_LIMIT_REACHED', status: 429, retryAfter: 5400 }),
      'kycRestart',
    ).message;
    expect(m).toContain('1 hour and 30 minutes');
  });

  it('fixes the discovery wording and has no INVALID_RANGE entry', () => {
    expect(REQUIRED_CODES).toEqual(expect.arrayContaining(['INVALID_CURSOR', 'PROFILE_NOT_FOUND']));
    expect(CODE_MESSAGES.INVALID_RANGE).toBeUndefined();
    expect(describeError(sample('INVALID_CURSOR', 400), 'discovery').message).toBe(
      'Your search results are out of date. Please start the search again.',
    );
    expect(describeError(sample('PROFILE_NOT_FOUND', 404), 'discovery').message).toBe(
      "This profile isn't available.",
    );
    expect(describeError(sample('PROFILE_NOT_APPROVED', 403), 'discovery').message).toBe(
      'Your profile needs to be approved before you can browse other profiles. You can follow its progress on your status page.',
    );
    const limitError = new ApiError({
      code: 'VALIDATION_ERROR',
      status: 400,
      details: { issues: ['limit must not be greater than 50', 'property ageMin should not exist'] },
    });
    expect(describeError(limitError, 'discovery').message).toBe(
      'That search could not be understood. Please clear the filters and try again.',
    );
  });

  it('asks to review updated documents on CONSENT_DOCUMENT_MISMATCH', () => {
    expect(describeError(sample('CONSENT_DOCUMENT_MISMATCH'), 'register').message).toMatch(
      /updated/i,
    );
  });
});
