import { dayKey, hourOfDay } from './clock';

const PARIS = 'Europe/Paris';

describe('dayKey', () => {
  test.each([
    ['2026-10-24T21:50:00Z', '2026-10-24'], // 23:50, summer time
    ['2026-10-24T22:10:00Z', '2026-10-25'], // 00:10, summer time
    ['2026-10-25T22:50:00Z', '2026-10-25'], // 23:50, winter time (clocks went back that night)
    ['2026-10-25T23:10:00Z', '2026-10-26'], // 00:10, winter time
    ['2026-03-28T22:50:00Z', '2026-03-28'], // 23:50, the night summer time starts
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
