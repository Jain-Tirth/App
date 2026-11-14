import { describe, expect, it } from 'vitest';
import { fileProblemCode, fileProblemMessage, isValidIdNumber, MAX_FILE_BYTES } from './kycFiles';

describe('fileProblemCode', () => {
  it('accepts JPEG, PNG and WebP for photos and ids, and PDF for ids only', () => {
    for (const type of ['image/jpeg', 'image/png', 'image/webp']) {
      expect(fileProblemCode('kycPhoto', { type, size: 1000 })).toBeNull();
      expect(fileProblemCode('kycId', { type, size: 1000 })).toBeNull();
    }
    expect(fileProblemCode('kycId', { type: 'application/pdf', size: 1000 })).toBeNull();
    expect(fileProblemCode('kycPhoto', { type: 'application/pdf', size: 1000 })).toBe(
      'FILE_TYPE_NOT_ALLOWED_FOR_PURPOSE',
    );
  });

  it('refuses unsupported types', () => {
    expect(fileProblemCode('kycId', { type: 'image/gif', size: 1000 })).toBe(
      'FILE_TYPE_NOT_ALLOWED',
    );
    expect(fileProblemCode('kycPhoto', { type: '', size: 1000 })).toBe('FILE_TYPE_NOT_ALLOWED');
  });

  it('allows exactly 10 MB and refuses one byte more', () => {
    expect(fileProblemCode('kycId', { type: 'image/png', size: MAX_FILE_BYTES })).toBeNull();
    expect(fileProblemCode('kycId', { type: 'image/png', size: MAX_FILE_BYTES + 1 })).toBe(
      'FILE_TOO_LARGE',
    );
  });

  it('refuses an empty file', () => {
    expect(fileProblemCode('kycId', { type: 'image/png', size: 0 })).not.toBeNull();
  });

  it('returns a friendly message', () => {
    expect(fileProblemMessage('kycId', { type: 'image/png', size: MAX_FILE_BYTES + 1 })).toMatch(
      /too large/i,
    );
    expect(fileProblemMessage('kycId', { type: 'image/png', size: 5 })).toBeNull();
  });
});

describe('isValidIdNumber', () => {
  it.each(['1234', 'ABCDE 1234-F', 'a'.repeat(32)])('accepts %s', (value) => {
    expect(isValidIdNumber(value)).toBe(true);
  });

  it.each(['123', '', 'a'.repeat(33), 'AB_1234', 'ABCD#1234'])('rejects %s', (value) => {
    expect(isValidIdNumber(value)).toBe(false);
  });
});
