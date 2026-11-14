import { businessHoursBetween, readSla } from './sla';
import type { BusinessHoursConfig } from './review.types';

const CONFIG: BusinessHoursConfig = {
  slaHours: 48,
  days: [1, 2, 3, 4, 5],
  startMinute: 9 * 60,
  endMinute: 18 * 60,
  timeZone: 'Asia/Kolkata',
};

// 2026-11-09 is a Monday. IST is UTC+05:30, so 09:00 IST is 03:30Z.
const MON_0900 = new Date('2026-11-09T03:30:00.000Z');

describe('businessHoursBetween', () => {
  it('counts one hour from Friday 17:00 to the next Monday 09:00', () => {
    const friday1700 = new Date('2026-11-13T11:30:00.000Z');
    const monday0900 = new Date('2026-11-16T03:30:00.000Z');

    expect(businessHoursBetween(friday1700, monday0900, CONFIG)).toBe(1);
  });

  it('does not count a weekend or the night', () => {
    const saturdayNoon = new Date('2026-11-14T06:30:00.000Z');
    const sundayNoon = new Date('2026-11-15T06:30:00.000Z');

    expect(businessHoursBetween(saturdayNoon, sundayNoon, CONFIG)).toBe(0);
  });

  it('starts counting at the next opening when submitted outside hours', () => {
    const saturday = new Date('2026-11-14T06:30:00.000Z');
    const mondayTen = new Date('2026-11-16T04:30:00.000Z');

    expect(businessHoursBetween(saturday, mondayTen, CONFIG)).toBe(1);
  });

  it('counts a full business day as nine hours', () => {
    const tuesday0900 = new Date('2026-11-10T03:30:00.000Z');

    expect(businessHoursBetween(MON_0900, tuesday0900, CONFIG)).toBe(9);
  });
});

describe('readSla boundaries', () => {
  const cases: [string, string, string, number][] = [
    ['35h59m', '2026-11-12T12:29:00.000Z', 'ok', 12 + 1 / 60],
    ['36h00m', '2026-11-12T12:30:00.000Z', 'atRisk', 12],
    ['47h59m', '2026-11-16T06:29:00.000Z', 'atRisk', 1 / 60],
    ['48h00m', '2026-11-16T06:30:00.000Z', 'overdue', 0],
  ];

  it.each(cases)('%s of business time is %s', (_label, at, state, remaining) => {
    const reading = readSla(MON_0900, new Date(at), CONFIG);

    expect(reading.slaState).toBe(state);
    expect(reading.slaRemainingHours).toBeCloseTo(remaining, 5);
  });

  it('reports negative remaining hours when overdue', () => {
    const reading = readSla(MON_0900, new Date('2026-11-17T06:30:00.000Z'), CONFIG);

    expect(reading.slaState).toBe('overdue');
    expect(reading.slaRemainingHours).toBe(-9);
  });
});
