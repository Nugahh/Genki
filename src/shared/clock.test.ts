import { addDays, dayBounds, dayKey, hourOfDay } from './clock';

const PARIS = 'Europe/Paris';

describe('dayKey', () => {
  test.each([
    ['2026-10-24T21:50:00Z', '2026-10-24'], // 23:50, summer time
    ['2026-10-24T22:10:00Z', '2026-10-25'], // 00:10, summer time
    ['2026-10-25T22:50:00Z', '2026-10-25'], // 23:50, winter time (clocks went back that night)
    ['2026-10-25T23:10:00Z', '2026-10-26'], // 00:10, winter time
    ['2026-03-28T22:50:00Z', '2026-03-28'], // 23:50, the night summer time starts
    ['2026-03-29T22:10:00Z', '2026-03-30'], // 00:10, summer time (a fixed +1 h offset would say 29)
  ])('%s falls on %s in Paris', (iso, day) => {
    expect(dayKey(new Date(iso), PARIS)).toBe(day);
  });
});

describe('hourOfDay', () => {
  test('counts minutes as a fraction of the hour', () => {
    expect(hourOfDay(new Date('2026-10-23T12:30:00Z'), PARIS)).toBe(14.5);
  });

  test('midnight is 0', () => {
    expect(hourOfDay(new Date('2026-10-23T22:00:00Z'), PARIS)).toBe(0);
  });
});

test('addDays crosses month and year ends', () => {
  expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
  expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
  expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
});

describe('dayBounds', () => {
  const hours = (day: string, zone: string) => {
    const { start, end } = dayBounds(day, zone);
    return (end.getTime() - start.getTime()) / 3600_000;
  };

  test('a day starts at midnight of the zone, whatever the zone', () => {
    expect(dayBounds('2026-11-03', 'Europe/Paris').start.toISOString()).toBe('2026-11-02T23:00:00.000Z');
    expect(dayBounds('2026-07-03', 'Europe/Paris').start.toISOString()).toBe('2026-07-02T22:00:00.000Z');
    expect(dayBounds('2026-11-03', 'America/New_York').start.toISOString()).toBe('2026-11-03T05:00:00.000Z');
    expect(dayBounds('2026-11-03', 'Pacific/Auckland').start.toISOString()).toBe('2026-11-02T11:00:00.000Z');
  });

  test('a day ends where the next begins', () => {
    expect(dayBounds('2026-11-03', 'Europe/Paris').end).toEqual(dayBounds('2026-11-04', 'Europe/Paris').start);
  });

  test('is 23 hours long when the clocks go forward and 25 when they go back', () => {
    expect(hours('2026-03-29', 'Europe/Paris')).toBe(23);
    expect(hours('2026-10-25', 'Europe/Paris')).toBe(25);
    expect(hours('2026-11-03', 'Europe/Paris')).toBe(24);
  });

  test('puts the last second of the day in the day and the first of the next out of it', () => {
    const { start, end } = dayBounds('2026-11-03', 'Europe/Paris');
    expect(dayKey(new Date(end.getTime() - 1000), 'Europe/Paris')).toBe('2026-11-03');
    expect(dayKey(end, 'Europe/Paris')).toBe('2026-11-04');
    expect(dayKey(start, 'Europe/Paris')).toBe('2026-11-03');
  });
});
