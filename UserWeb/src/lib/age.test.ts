import { describe, expect, it } from 'vitest';
import { ageInYearsUtc, dateOfBirthHint, parseIsoDate, todayUtc } from './age';

const at = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

describe('ageInYearsUtc', () => {
  it('counts whole years on and before the birthday', () => {
    expect(ageInYearsUtc('2000-06-15', at('2026-06-14'))).toBe(25);
    expect(ageInYearsUtc('2000-06-15', at('2026-06-15'))).toBe(26);
  });

  it('counts a 29 February birthday from 1 March in non-leap years', () => {
    expect(ageInYearsUtc('2000-02-29', at('2025-02-28'))).toBe(24);
    expect(ageInYearsUtc('2000-02-29', at('2025-03-01'))).toBe(25);
  });

  it('counts a 29 February birthday on 29 February in leap years', () => {
    expect(ageInYearsUtc('2000-02-29', at('2028-02-28'))).toBe(27);
    expect(ageInYearsUtc('2000-02-29', at('2028-02-29'))).toBe(28);
  });

  it('uses UTC, not the local clock', () => {
    const lateEvening = new Date('2026-06-14T23:30:00.000Z');
    expect(ageInYearsUtc('2000-06-15', lateEvening)).toBe(25);
  });

  it('rejects malformed and impossible dates and reports future dates as negative', () => {
    expect(ageInYearsUtc('15/06/2000', at('2026-01-01'))).toBeNull();
    expect(ageInYearsUtc('2001-02-29', at('2026-01-01'))).toBeNull();
    expect(ageInYearsUtc('2030-01-01', at('2026-01-01'))).toBeLessThan(0);
    expect(parseIsoDate('2000-13-01')).toBeNull();
  });
});

describe('todayUtc', () => {
  it('formats the UTC date', () => {
    expect(todayUtc(new Date('2026-11-14T23:59:59.000Z'))).toBe('2026-11-14');
  });
});

describe('dateOfBirthHint', () => {
  const now = at('2026-11-14');

  it('applies 21 for men and 18 for women', () => {
    expect(dateOfBirthHint('male', '2007-01-01', now)).toContain('21');
    expect(dateOfBirthHint('female', '2007-01-01', now)).toBeNull();
    expect(dateOfBirthHint('female', '2010-01-01', now)).toContain('18');
    expect(dateOfBirthHint('male', '2005-11-14', now)).toBeNull();
    expect(dateOfBirthHint('male', '2005-11-15', now)).toContain('21');
  });

  it('flags a future or impossible date', () => {
    expect(dateOfBirthHint('male', '2030-01-01', now)).toMatch(/not in the future/i);
    expect(dateOfBirthHint('male', '2001-02-30', now)).toMatch(/real date/i);
  });

  it('stays quiet for an empty field', () => {
    expect(dateOfBirthHint('male', '', now)).toBeNull();
  });
});
