import type { BusinessHoursConfig, SlaState } from './review.types';

const MS_PER_MINUTE = 60_000;
const MS_PER_HOUR = 3_600_000;
/** Items are at risk from three quarters of the SLA (36 of 48 hours). */
const AT_RISK_FRACTION = 0.75;

interface LocalDate {
  year: number;
  month: number;
  day: number;
}

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  let found = formatters.get(timeZone);

  if (!found) {
    found = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
    });
    formatters.set(timeZone, found);
  }

  return found;
}

/** Wall-clock parts of an instant in `timeZone`, as a UTC-based epoch. */
function wallClockMs(instantMs: number, timeZone: string): number {
  const parts: Record<string, number> = {};

  for (const part of formatterFor(timeZone).formatToParts(new Date(instantMs))) {
    if (part.type !== 'literal') {
      parts[part.type] = Number(part.value);
    }
  }

  return Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
}

function localDateOf(instantMs: number, timeZone: string): LocalDate {
  const wall = new Date(wallClockMs(instantMs, timeZone));

  return {
    year: wall.getUTCFullYear(),
    month: wall.getUTCMonth() + 1,
    day: wall.getUTCDate(),
  };
}

/** The instant at which `minuteOfDay` is on the wall clock of `date` in `timeZone`. */
function instantAt(date: LocalDate, minuteOfDay: number, timeZone: string): number {
  const wall = Date.UTC(date.year, date.month - 1, date.day, 0, minuteOfDay);
  let instant = wall - (wallClockMs(wall, timeZone) - wall);
  instant = wall - (wallClockMs(instant, timeZone) - instant);

  return instant;
}

function isoWeekday(date: LocalDate): number {
  const day = new Date(Date.UTC(date.year, date.month - 1, date.day)).getUTCDay();

  return day === 0 ? 7 : day;
}

function nextDay(date: LocalDate): LocalDate {
  const next = new Date(Date.UTC(date.year, date.month - 1, date.day + 1));

  return {
    year: next.getUTCFullYear(),
    month: next.getUTCMonth() + 1,
    day: next.getUTCDate(),
  };
}

/**
 * Business time between two instants, in milliseconds. Only the configured
 * weekdays and the configured daily window count; time outside them is skipped,
 * so a start outside business hours begins counting at the next opening.
 */
export function businessMillisBetween(
  from: Date,
  to: Date,
  config: BusinessHoursConfig,
): number {
  const startMs = from.getTime();
  const endMs = to.getTime();

  if (endMs <= startMs) {
    return 0;
  }

  const last = localDateOf(endMs, config.timeZone);
  let cursor = localDateOf(startMs, config.timeZone);
  let total = 0;

  for (;;) {
    if (config.days.includes(isoWeekday(cursor))) {
      const opens = instantAt(cursor, config.startMinute, config.timeZone);
      const closes = instantAt(cursor, config.endMinute, config.timeZone);
      const overlap = Math.min(closes, endMs) - Math.max(opens, startMs);

      if (overlap > 0) {
        total += overlap;
      }
    }

    if (
      cursor.year === last.year &&
      cursor.month === last.month &&
      cursor.day === last.day
    ) {
      return total;
    }

    cursor = nextDay(cursor);
  }
}

export function businessHoursBetween(
  from: Date,
  to: Date,
  config: BusinessHoursConfig,
): number {
  return businessMillisBetween(from, to, config) / MS_PER_HOUR;
}

/** `ok` under 36 business hours, `atRisk` from 36, `overdue` from 48. */
export function slaStateFor(
  elapsedMillis: number,
  config: BusinessHoursConfig,
): SlaState {
  const slaMs = config.slaHours * MS_PER_HOUR;

  if (elapsedMillis >= slaMs) {
    return 'overdue';
  }

  return elapsedMillis >= slaMs * AT_RISK_FRACTION ? 'atRisk' : 'ok';
}

export interface SlaReading {
  slaRemainingHours: number;
  slaState: SlaState;
}

export function readSla(
  submittedAt: Date,
  now: Date,
  config: BusinessHoursConfig,
): SlaReading {
  const elapsed = businessMillisBetween(submittedAt, now, config);
  const remainingMinutes = Math.round(
    (config.slaHours * MS_PER_HOUR - elapsed) / MS_PER_MINUTE,
  );

  return {
    slaRemainingHours: remainingMinutes / 60,
    slaState: slaStateFor(elapsed, config),
  };
}
