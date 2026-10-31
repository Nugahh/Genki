import { savings, streaks } from './tobacco';

describe('streaks', () => {
  test('without a relapse the current streak and the record are the days since the quit date', () => {
    expect(streaks('2026-10-01', [], '2026-10-11')).toEqual({ current: 10, record: 10, smokeFreeDays: 10 });
  });

  test('a relapse restarts the current streak at its day, keeps the record, and takes its day off the smoke-free days', () => {
    expect(streaks('2026-10-01', ['2026-10-05'], '2026-10-11')).toEqual({ current: 6, record: 6, smokeFreeDays: 9 });
    expect(streaks('2026-10-01', ['2026-10-09'], '2026-10-11')).toEqual({ current: 2, record: 8, smokeFreeDays: 9 });
  });

  test('two relapses on one day are one', () => {
    expect(streaks('2026-10-01', ['2026-10-05', '2026-10-05'], '2026-10-11')).toEqual(streaks('2026-10-01', ['2026-10-05'], '2026-10-11'));
  });

  test('the record is the longest run between cigarettes', () => {
    // Runs: 1-3 (2 days), 3-12 (9 days), 12-14 (2 days).
    expect(streaks('2026-10-01', ['2026-10-03', '2026-10-12'], '2026-10-14')).toEqual({ current: 2, record: 9, smokeFreeDays: 11 });
  });

  test('a relapse today makes the current streak zero', () => {
    expect(streaks('2026-10-01', ['2026-10-11'], '2026-10-11')).toEqual({ current: 0, record: 10, smokeFreeDays: 9 });
  });

  test('a relapse before the quit date, or after today, does not count', () => {
    expect(streaks('2026-10-05', ['2026-10-01', '2026-10-20'], '2026-10-11')).toEqual({ current: 6, record: 6, smokeFreeDays: 6 });
  });

  test('the quit day itself is day zero; a quit date to come, or none, is zero', () => {
    expect(streaks('2026-10-11', [], '2026-10-11')).toEqual({ current: 0, record: 0, smokeFreeDays: 0 });
    expect(streaks('2026-10-20', [], '2026-10-11')).toEqual({ current: 0, record: 0, smokeFreeDays: 0 });
    expect(streaks(undefined, ['2026-10-05'], '2026-10-11')).toEqual({ current: 0, record: 0, smokeFreeDays: 0 });
  });

  test('crosses a clock change without drift', () => {
    expect(streaks('2026-10-20', [], '2026-11-02').current).toBe(13);
  });
});

describe('savings', () => {
  test('the cigarettes not smoked, at the price of the pack', () => {
    expect(savings(10, { cigarettesPerDay: 20, packPrice: 12, packSize: 20 })).toBe(120);
    expect(savings(3, { cigarettesPerDay: 10, packPrice: 11, packSize: 20 })).toBeCloseTo(16.5, 5);
  });

  test('nothing without the number a day or the price', () => {
    expect(savings(10, { packPrice: 12, packSize: 20 })).toBeUndefined();
    expect(savings(10, { cigarettesPerDay: 20, packSize: 20 })).toBeUndefined();
  });
});
