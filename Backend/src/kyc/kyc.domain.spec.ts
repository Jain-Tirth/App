import { HttpStatus } from '@nestjs/common';
import { ApiException } from '../common/api-error';
import {
  decideRestart,
  detectFileKind,
  lastFour,
  normalizeIdNumber,
  transitionKycStatus,
  validateDeclaredUpload,
  validateStoredFile,
} from './kyc.domain';

const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46]);
const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const webp = Buffer.concat([
  Buffer.from('RIFF'),
  Buffer.from([0x24, 0, 0, 0]),
  Buffer.from('WEBPVP8 '),
]);
const pdf = Buffer.from('%PDF-1.7\n');
const text = Buffer.from('hello, I am not an image');

function codeOf(fn: () => unknown): string {
  try {
    fn();
  } catch (error) {
    if (error instanceof ApiException) {
      return error.code;
    }
    throw error;
  }
  return 'NO_ERROR';
}

describe('transitionKycStatus', () => {
  it.each([
    ['notStarted', 'start', 'consentGiven'],
    ['consentGiven', 'documentAttached', 'documentUploaded'],
    ['documentUploaded', 'documentAttached', 'documentUploaded'],
    ['consentGiven', 'allDocumentsAttached', 'needsReview'],
    ['documentUploaded', 'allDocumentsAttached', 'needsReview'],
    ['failed', 'restart', 'consentGiven'],
    ['changesNeeded', 'restart', 'consentGiven'],
  ] as const)('%s + %s -> %s', (from, event, to) => {
    expect(transitionKycStatus(from, event)).toBe(to);
  });

  it.each([
    ['consentGiven', 'start'],
    ['needsReview', 'documentAttached'],
    ['needsReview', 'allDocumentsAttached'],
    ['needsReview', 'restart'],
    ['approved', 'restart'],
    ['consentGiven', 'restart'],
    ['failed', 'documentAttached'],
  ] as const)('%s + %s is rejected with 409', (from, event) => {
    expect(() => transitionKycStatus(from, event)).toThrow(ApiException);
    expect(codeOf(() => transitionKycStatus(from, event))).toBe(
      'INVALID_STATUS_TRANSITION',
    );
  });
});

describe('detectFileKind (magic bytes)', () => {
  it('recognises jpeg, png, webp and pdf by content', () => {
    expect(detectFileKind(jpeg)).toBe('jpeg');
    expect(detectFileKind(png)).toBe('png');
    expect(detectFileKind(webp)).toBe('webp');
    expect(detectFileKind(pdf)).toBe('pdf');
  });

  it('returns null for anything else', () => {
    expect(detectFileKind(text)).toBeNull();
    expect(detectFileKind(Buffer.alloc(0))).toBeNull();
  });
});

describe('validateDeclaredUpload', () => {
  const tenMb = 10 * 1024 * 1024;

  it('accepts exactly 10 MB of a valid type', () => {
    expect(() =>
      validateDeclaredUpload('kycPhoto', 'image/jpeg', tenMb),
    ).not.toThrow();
  });

  it('rejects 10 MB plus one byte as FILE_TOO_LARGE', () => {
    expect(
      codeOf(() => validateDeclaredUpload('kycPhoto', 'image/jpeg', tenMb + 1)),
    ).toBe('FILE_TOO_LARGE');
  });

  it('rejects a PDF photo as FILE_TYPE_NOT_ALLOWED_FOR_PURPOSE', () => {
    expect(
      codeOf(() => validateDeclaredUpload('kycPhoto', 'application/pdf', 100)),
    ).toBe('FILE_TYPE_NOT_ALLOWED_FOR_PURPOSE');
  });

  it('accepts a PDF ID proof', () => {
    expect(() =>
      validateDeclaredUpload('kycId', 'application/pdf', 100),
    ).not.toThrow();
  });

  it('rejects an unlisted type as FILE_TYPE_NOT_ALLOWED', () => {
    expect(
      codeOf(() => validateDeclaredUpload('kycId', 'image/gif', 100)),
    ).toBe('FILE_TYPE_NOT_ALLOWED');
  });
});

describe('validateStoredFile', () => {
  it('accepts content that matches the declared type', () => {
    expect(() => validateStoredFile('kycPhoto', 'image/png', png)).not.toThrow();
    expect(() => validateStoredFile('kycId', 'application/pdf', pdf)).not.toThrow();
  });

  it('rejects text declared as an image', () => {
    expect(
      codeOf(() => validateStoredFile('kycPhoto', 'image/jpeg', text)),
    ).toBe('FILE_CONTENT_MISMATCH');
  });

  it('rejects an image whose content differs from the declared type', () => {
    expect(
      codeOf(() => validateStoredFile('kycPhoto', 'image/jpeg', png)),
    ).toBe('FILE_CONTENT_MISMATCH');
  });

  it('rejects PDF bytes uploaded for the member photo', () => {
    expect(
      codeOf(() => validateStoredFile('kycPhoto', 'image/jpeg', pdf)),
    ).toBe('FILE_TYPE_NOT_ALLOWED_FOR_PURPOSE');
  });

  it('carries an HTTP 400 status', () => {
    expect.assertions(1);

    try {
      validateStoredFile('kycPhoto', 'image/jpeg', text);
    } catch (error) {
      expect((error as ApiException).status).toBe(HttpStatus.BAD_REQUEST);
    }
  });
});

describe('ID number handling', () => {
  it('normalises spaces, hyphens and case', () => {
    expect(normalizeIdNumber(' 1234 5678-9012 ')).toBe('123456789012');
    expect(normalizeIdNumber('abcde1234f')).toBe('ABCDE1234F');
  });

  it('exposes only the last four characters', () => {
    expect(lastFour('123456789012')).toBe('9012');
    expect(lastFour('ABCDE1234F')).toBe('234F');
  });
});

describe('decideRestart (3 per 24 hours)', () => {
  const now = new Date('2026-11-14T12:00:00.000Z');
  const hoursAgo = (hours: number) =>
    new Date(now.getTime() - hours * 3_600_000);

  it('allows a restart with two earlier restarts in the window', () => {
    expect(decideRestart([hoursAgo(1), hoursAgo(2)], now)).toEqual({
      allowed: true,
    });
  });

  it('blocks the 4th restart and reports Retry-After from the oldest', () => {
    const decision = decideRestart(
      [hoursAgo(1), hoursAgo(2), hoursAgo(10)],
      now,
    );

    expect(decision).toEqual({ allowed: false, retryAfterSeconds: 14 * 3600 });
  });

  it('does not count a restart made exactly 24 hours ago', () => {
    expect(
      decideRestart([hoursAgo(24), hoursAgo(2), hoursAgo(1)], now),
    ).toEqual({ allowed: true });
  });

  it('counts a restart made 23h59m59s ago', () => {
    const almost = new Date(now.getTime() - (24 * 3600 - 1) * 1000);

    expect(decideRestart([almost, hoursAgo(2), hoursAgo(1)], now)).toEqual({
      allowed: false,
      retryAfterSeconds: 1,
    });
  });
});
