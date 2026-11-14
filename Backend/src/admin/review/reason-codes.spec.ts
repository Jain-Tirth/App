import { allowedReasonCodes, validateReasonCode } from './reason-codes';
import { REVIEW_REASON_CODES } from './review.types';

function codeOf(fn: () => unknown): unknown {
  try {
    fn();
  } catch (error) {
    return (error as { code?: string }).code;
  }

  return undefined;
}

describe('validateReasonCode', () => {
  it('has the eleven seeded codes', () => {
    expect(REVIEW_REASON_CODES).toHaveLength(11);
  });

  it('lets reject use all eleven', () => {
    for (const code of REVIEW_REASON_CODES) {
      expect(validateReasonCode('reject', code)).toBe(code);
    }
  });

  it('requires a code on reject and request changes', () => {
    expect(codeOf(() => validateReasonCode('reject', undefined))).toBe(
      'INVALID_REASON_CODE',
    );
    expect(codeOf(() => validateReasonCode('requestChanges', ''))).toBe(
      'INVALID_REASON_CODE',
    );
  });

  it('lets approve omit the code but not send an unknown one', () => {
    expect(validateReasonCode('approve', undefined)).toBeNull();
    expect(codeOf(() => validateReasonCode('approve', 'nope'))).toBe(
      'INVALID_REASON_CODE',
    );
  });

  it('excludes under-age and duplicate-account from request changes', () => {
    expect(allowedReasonCodes('requestChanges')).toHaveLength(9);
    expect(codeOf(() => validateReasonCode('requestChanges', 'under-age'))).toBe(
      'INVALID_REASON_CODE',
    );
    expect(
      codeOf(() => validateReasonCode('requestChanges', 'duplicate-account')),
    ).toBe('INVALID_REASON_CODE');
  });
});
