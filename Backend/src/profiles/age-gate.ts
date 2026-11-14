export type AgeGateGender = 'male' | 'female';

export interface AgeMinimums {
  male: number;
  female: number;
}

export type AgeGateResult =
  | { ok: true; age: number }
  | { ok: false; reason: 'INVALID_DATE_OF_BIRTH' }
  | { ok: false; reason: 'AGE_BELOW_MINIMUM'; minimumAge: number };

interface CalendarDate {
  year: number;
  month: number;
  day: number;
}

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

function parseCalendarDate(value: unknown): CalendarDate | null {
  if (typeof value !== 'string') {
    return null;
  }

  const match = DATE_ONLY.exec(value);

  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const probe = new Date(Date.UTC(year, month - 1, day));

  // Date.UTC rolls over impossible dates (e.g. 2001-02-29 becomes 1 March), so
  // a round trip that changes any component means the input was not real.
  if (
    probe.getUTCFullYear() !== year ||
    probe.getUTCMonth() !== month - 1 ||
    probe.getUTCDate() !== day
  ) {
    return null;
  }

  return { year, month, day };
}

/** True for a real `YYYY-MM-DD` calendar date. */
export function isCalendarDate(value: unknown): boolean {
  return parseCalendarDate(value) !== null;
}

/**
 * The single age rule for every date of birth the API accepts.
 *
 * Age is whole calendar years between `dateOfBirth` and the UTC date of
 * `today`. Leap-day convention: a 29 February birthday is reached on 1 March
 * in non-leap years, so a person born on 29 February is a year older on
 * 1 March, and not on 28 February.
 */
export function evaluateAgeGate(
  gender: AgeGateGender,
  dateOfBirth: string,
  today: Date,
  minimums: AgeMinimums,
): AgeGateResult {
  const birth = parseCalendarDate(dateOfBirth);

  if (!birth) {
    return { ok: false, reason: 'INVALID_DATE_OF_BIRTH' };
  }

  const current: CalendarDate = {
    year: today.getUTCFullYear(),
    month: today.getUTCMonth() + 1,
    day: today.getUTCDate(),
  };

  const birthdayNotReached =
    current.month < birth.month ||
    (current.month === birth.month && current.day < birth.day);
  const age = current.year - birth.year - (birthdayNotReached ? 1 : 0);

  if (age < 0) {
    return { ok: false, reason: 'INVALID_DATE_OF_BIRTH' };
  }

  const minimumAge = minimums[gender];

  if (age < minimumAge) {
    return { ok: false, reason: 'AGE_BELOW_MINIMUM', minimumAge };
  }

  return { ok: true, age };
}
