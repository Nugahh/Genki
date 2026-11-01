import { addDays, bucketsFor, mondayOf, periodTitle, rangeOf, shiftAnchor } from './period';

describe('addDays and mondayOf', () => {
  test('addDays crosses month and year ends', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
  });

  test('a week starts on Monday, a Sunday belongs to the week before', () => {
    expect(mondayOf('2026-10-26')).toBe('2026-10-26'); // a Monday
    expect(mondayOf('2026-10-31')).toBe('2026-10-26'); // a Saturday
    expect(mondayOf('2026-11-01')).toBe('2026-10-26'); // a Sunday
    expect(mondayOf('2026-11-02')).toBe('2026-11-02');
  });
});

describe('bucketsFor', () => {
  test('a day is one bucket', () => {
    expect(bucketsFor('day', '2026-10-31')).toEqual([{ key: '2026-10-31', label: 'sam.', spoken: 'samedi', from: '2026-10-31', to: '2026-10-31' }]);
  });

  test('a week is its seven days, Monday to Sunday', () => {
    const buckets = bucketsFor('week', '2026-10-31');
    expect(buckets.map((b) => b.label)).toEqual(['lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.', 'dim.']);
    expect([buckets[0].from, buckets[6].to]).toEqual(['2026-10-26', '2026-11-01']);
    expect(buckets.map((b) => b.spoken)).toEqual(['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche']);
    expect(buckets.every((b) => b.from === b.to && b.key === b.from)).toBe(true);
  });

  test('a year is its twelve months, with the real last day of each', () => {
    const buckets = bucketsFor('year', '2028-05-10');
    expect(buckets.map((b) => b.label)).toEqual(['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.']);
    expect(buckets[0]).toMatchObject({ key: '2028-01', spoken: 'janvier', from: '2028-01-01', to: '2028-01-31' });
    expect(buckets[1].to).toBe('2028-02-29');
    expect(buckets[11].to).toBe('2028-12-31');
  });

  test('a month is one numbered bucket per day of the calendar month', () => {
    const buckets = bucketsFor('month', '2026-11-15');
    expect(buckets).toHaveLength(30);
    expect(buckets[0]).toEqual({ key: '2026-11-01', label: '1', spoken: '1er novembre', from: '2026-11-01', to: '2026-11-01' });
    expect(buckets[2]).toMatchObject({ label: '3', spoken: '3 novembre' });
    expect(buckets[29]).toMatchObject({ key: '2026-11-30', label: '30' });
  });

  test.each([
    ['2026-10-15', 31],
    ['2026-02-10', 28],
    ['2028-02-10', 29], // a leap year
  ])('the month around %s has %i days', (anchor, days) => {
    expect(bucketsFor('month', anchor)).toHaveLength(days);
  });

  test('rangeOf spans the first day to the last', () => {
    expect(rangeOf(bucketsFor('week', '2026-10-31'))).toEqual({ from: '2026-10-26', to: '2026-11-01' });
    expect(rangeOf(bucketsFor('month', '2026-11-15'))).toEqual({ from: '2026-11-01', to: '2026-11-30' });
    expect(rangeOf(bucketsFor('year', '2026-10-31'))).toEqual({ from: '2026-01-01', to: '2026-12-31' });
  });
});

describe('shiftAnchor', () => {
  test.each([
    ['day', '2026-11-01', -1, '2026-10-31'],
    ['week', '2026-11-01', -1, '2026-10-25'],
    ['week', '2026-11-01', 1, '2026-11-08'],
    ['month', '2026-11-15', -1, '2026-10-15'],
    ['month', '2026-11-15', 1, '2026-12-15'],
    ['month', '2026-12-20', 1, '2027-01-20'], // into the next year
    ['month', '2026-01-20', -1, '2025-12-20'], // back into the last
    ['month', '2026-03-31', -1, '2026-02-28'], // February is shorter
    ['month', '2026-01-31', 1, '2026-02-28'],
    ['month', '2028-03-31', -1, '2028-02-29'],
    ['year', '2026-10-31', -1, '2025-10-31'],
    ['year', '2028-02-29', 1, '2029-02-28'], // no 29 February next year
  ] as const)('%s from %s by %i is %s', (period, anchor, step, expected) => {
    expect(shiftAnchor(period, anchor, step)).toBe(expected);
  });
});

describe('periodTitle', () => {
  test('names the period the way it is read', () => {
    expect(periodTitle('day', '2026-10-31')).toBe('samedi 31 octobre');
    expect(periodTitle('week', '2026-10-31')).toBe('Semaine du 26 oct. au 1 nov.');
    expect(periodTitle('month', '2026-11-15')).toBe('novembre 2026');
    expect(periodTitle('month', '2027-01-03')).toBe('janvier 2027');
    expect(periodTitle('year', '2026-10-31')).toBe('2026');
  });
});
