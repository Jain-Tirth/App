import { ApiException } from '../common/api-error';
import { ShortlistLimitsService } from './shortlist-limits.service';

function codeOf(action: () => void): string | null {
  try {
    action();
    return null;
  } catch (error) {
    return error instanceof ApiException ? (error.code) : 'OTHER';
  }
}

describe('ShortlistLimitsService', () => {
  describe('profiles', () => {
    const limits = new ShortlistLimitsService({ maxLists: null, maxProfiles: 3 });

    it('allows the Nth distinct profile and rejects the (N+1)th', () => {
      expect(codeOf(() => limits.assertCanAddProfile(2, false))).toBeNull();
      expect(codeOf(() => limits.assertCanAddProfile(3, false))).toBe(
        'SHORTLIST_LIMIT_EXCEEDED',
      );
    });

    it('does not count a profile the member already shortlisted elsewhere', () => {
      expect(codeOf(() => limits.assertCanAddProfile(3, true))).toBeNull();
    });
  });

  describe('lists', () => {
    const limits = new ShortlistLimitsService({ maxLists: 2, maxProfiles: null });

    it('allows the Mth list and rejects the (M+1)th', () => {
      expect(codeOf(() => limits.assertCanCreateList(1))).toBeNull();
      expect(codeOf(() => limits.assertCanCreateList(2))).toBe(
        'SHORTLIST_LIMIT_EXCEEDED',
      );
    });
  });

  it('applies no limit when nothing is configured', () => {
    const limits = new ShortlistLimitsService({ maxLists: null, maxProfiles: null });

    expect(codeOf(() => limits.assertCanCreateList(10_000))).toBeNull();
    expect(codeOf(() => limits.assertCanAddProfile(10_000, false))).toBeNull();
  });
});
