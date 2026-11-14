import { describeCode } from '../errors/messages';
import type { Gender } from '../types';

/** Client hint only; the server is authoritative (AGE_MIN_MALE / AGE_MIN_FEMALE). */
export const MINIMUM_AGE: Record<Gender, number> = { male: 21, female: 18 };

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** Today's date in UTC as YYYY-MM-DD, used as the date input's max. */
export function todayUtc(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/** Parses a strict YYYY-MM-DD real calendar date. */
export function parseIsoDate(value: string): { y: number; m: number; d: number } | null {
  const match = ISO_DATE.exec(value);
  if (!match) return null;
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  const probe = new Date(Date.UTC(y, m - 1, d));
  if (
    probe.getUTCFullYear() !== y ||
    probe.getUTCMonth() !== m - 1 ||
    probe.getUTCDate() !== d
  ) {
    return null;
  }
  return { y, m, d };
}

/**
 * Whole calendar years between the birth date and today, both in UTC. A person
 * born on 29 February reaches each birthday on 1 March in non-leap years.
 * Returns null for a malformed date and a negative number for a future date.
 */
export function ageInYearsUtc(dateOfBirth: string, now: Date = new Date()): number | null {
  const birth = parseIsoDate(dateOfBirth);
  if (!birth) return null;
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth() + 1;
  const day = now.getUTCDate();

  let birthdayMonth = birth.m;
  let birthdayDay = birth.d;
  if (birth.m === 2 && birth.d === 29 && !isLeapYear(year)) {
    birthdayMonth = 3;
    birthdayDay = 1;
  }

  let age = year - birth.y;
  if (month < birthdayMonth || (month === birthdayMonth && day < birthdayDay)) {
    age -= 1;
  }
  return age;
}

/**
 * Inline hint for the date-of-birth field, or null when the date looks fine.
 * The text comes from the central mapper so it reads like the server's answer.
 */
export function dateOfBirthHint(
  gender: Gender,
  dateOfBirth: string,
  now: Date = new Date(),
): string | null {
  if (!dateOfBirth) return null;
  const parsed = parseIsoDate(dateOfBirth);
  if (!parsed || dateOfBirth > todayUtc(now)) {
    return describeCode('INVALID_DATE_OF_BIRTH', null, 'step').fields.dateOfBirth;
  }
  const age = ageInYearsUtc(dateOfBirth, now);
  const minimumAge = MINIMUM_AGE[gender];
  if (age !== null && age < minimumAge) {
    return describeCode('AGE_BELOW_MINIMUM', { minimumAge }, 'step').fields.dateOfBirth;
  }
  return null;
}
