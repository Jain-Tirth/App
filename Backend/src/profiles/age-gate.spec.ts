import { evaluateAgeGate, isCalendarDate, type AgeMinimums } from './age-gate';

const MINIMUMS: AgeMinimums = { male: 21, female: 18 };

function utc(iso: string): Date {
  return new Date(`${iso}T10:30:00.000Z`);
}

describe('evaluateAgeGate', () => {
  describe('men, minimum 21', () => {
    it('accepts on the 21st birthday', () => {
      expect(
        evaluateAgeGate('male', '2005-06-15', utc('2026-06-15'), MINIMUMS),
      ).toEqual({ ok: true, age: 21 });
    });

    it('accepts after the 21st birthday', () => {
      expect(
        evaluateAgeGate('male', '2005-06-15', utc('2026-06-16'), MINIMUMS),
      ).toEqual({ ok: true, age: 21 });
    });

    it('rejects the day before the 21st birthday', () => {
      expect(
        evaluateAgeGate('male', '2005-06-15', utc('2026-06-14'), MINIMUMS),
      ).toEqual({ ok: false, reason: 'AGE_BELOW_MINIMUM', minimumAge: 21 });
    });
  });

  describe('women, minimum 18', () => {
    it('accepts on the 18th birthday', () => {
      expect(
        evaluateAgeGate('female', '2008-06-15', utc('2026-06-15'), MINIMUMS),
      ).toEqual({ ok: true, age: 18 });
    });

    it('accepts after the 18th birthday', () => {
      expect(
        evaluateAgeGate('female', '2008-06-15', utc('2026-06-16'), MINIMUMS),
      ).toEqual({ ok: true, age: 18 });
    });

    it('rejects the day before the 18th birthday', () => {
      expect(
        evaluateAgeGate('female', '2008-06-15', utc('2026-06-14'), MINIMUMS),
      ).toEqual({ ok: false, reason: 'AGE_BELOW_MINIMUM', minimumAge: 18 });
    });
  });

  it('uses the supplied minimums', () => {
    expect(
      evaluateAgeGate('male', '2005-06-15', utc('2026-06-15'), {
        male: 22,
        female: 18,
      }),
    ).toEqual({ ok: false, reason: 'AGE_BELOW_MINIMUM', minimumAge: 22 });
  });

  describe('leap-day births (birthday is 1 March in non-leap years)', () => {
    it('is not yet 18 on 28 February of a non-leap year', () => {
      expect(
        evaluateAgeGate('female', '2008-02-29', utc('2026-02-28'), MINIMUMS),
      ).toEqual({ ok: false, reason: 'AGE_BELOW_MINIMUM', minimumAge: 18 });
    });

    it('is 18 on 1 March of a non-leap year', () => {
      expect(
        evaluateAgeGate('female', '2008-02-29', utc('2026-03-01'), MINIMUMS),
      ).toEqual({ ok: true, age: 18 });
    });

    it('is 20 on 29 February of a leap year', () => {
      expect(
        evaluateAgeGate('male', '2004-02-29', utc('2024-02-29'), MINIMUMS),
      ).toEqual({ ok: false, reason: 'AGE_BELOW_MINIMUM', minimumAge: 21 });
    });
  });

  describe('month and year rollovers', () => {
    it('handles a birthday on 31 December at the year boundary', () => {
      expect(
        evaluateAgeGate('female', '2007-12-31', utc('2025-12-31'), MINIMUMS),
      ).toEqual({ ok: true, age: 18 });
      expect(
        evaluateAgeGate('female', '2007-12-31', utc('2025-12-30'), MINIMUMS),
      ).toEqual({ ok: false, reason: 'AGE_BELOW_MINIMUM', minimumAge: 18 });
    });

    it('handles a birthday on 1 January at the year boundary', () => {
      expect(
        evaluateAgeGate('female', '2008-01-01', utc('2026-01-01'), MINIMUMS),
      ).toEqual({ ok: true, age: 18 });
      expect(
        evaluateAgeGate('female', '2008-01-01', utc('2025-12-31'), MINIMUMS),
      ).toEqual({ ok: false, reason: 'AGE_BELOW_MINIMUM', minimumAge: 18 });
    });

    it('handles the month rollover from 30 April to 1 May', () => {
      expect(
        evaluateAgeGate('male', '2005-05-01', utc('2026-04-30'), MINIMUMS),
      ).toEqual({ ok: false, reason: 'AGE_BELOW_MINIMUM', minimumAge: 21 });
      expect(
        evaluateAgeGate('male', '2005-05-01', utc('2026-05-01'), MINIMUMS),
      ).toEqual({ ok: true, age: 21 });
    });

    it('uses the UTC date, not the local time zone', () => {
      expect(
        evaluateAgeGate(
          'female',
          '2008-06-15',
          new Date('2026-06-14T23:59:59.999Z'),
          MINIMUMS,
        ),
      ).toEqual({ ok: false, reason: 'AGE_BELOW_MINIMUM', minimumAge: 18 });
    });
  });

  describe('invalid dates of birth', () => {
    it('rejects a date of birth in the future', () => {
      expect(
        evaluateAgeGate('male', '2026-06-16', utc('2026-06-15'), MINIMUMS),
      ).toEqual({ ok: false, reason: 'INVALID_DATE_OF_BIRTH' });
    });

    it('accepts no future date even by one day for a woman', () => {
      expect(
        evaluateAgeGate('female', '2027-01-01', utc('2026-06-15'), MINIMUMS),
      ).toEqual({ ok: false, reason: 'INVALID_DATE_OF_BIRTH' });
    });

    it('rejects a value that is not a real calendar date', () => {
      expect(
        evaluateAgeGate('male', '2001-02-29', utc('2026-06-15'), MINIMUMS),
      ).toEqual({ ok: false, reason: 'INVALID_DATE_OF_BIRTH' });
    });
  });
});

describe('isCalendarDate', () => {
  it.each(['2000-02-29', '1999-12-31', '2026-06-15'])('accepts %s', (value) => {
    expect(isCalendarDate(value)).toBe(true);
  });

  it.each([
    '2000-13-45',
    '2001-02-29',
    '2026-04-31',
    '2026-00-10',
    '2026-6-15',
    '2026-06-15T00:00:00Z',
    'yesterday',
    '',
  ])('rejects %s', (value) => {
    expect(isCalendarDate(value)).toBe(false);
  });

  it('rejects a non-string value', () => {
    expect(isCalendarDate(20000101)).toBe(false);
  });
});
