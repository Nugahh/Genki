import { daysToCorrect, totalsFromEntries } from './totals';

const food = (day: string, kcal: number, protein = 0, carbs = 0, fat = 0) => ({ day, kcal, protein, carbs, fat });

describe('totalsFromEntries', () => {
  test('sums the entries of each day', () => {
    const totals = totalsFromEntries({
      water: [{ day: '2026-11-02', ml: 250 }, { day: '2026-11-02', ml: 500 }, { day: '2026-11-03', ml: 250 }],
      food: [food('2026-11-02', 500, 30, 60, 10), food('2026-11-02', 300, 20, 30, 5)],
      days: new Map(),
    });
    expect(totals.get('2026-11-02')).toEqual({ waterMl: 750, kcal: 800, proteinG: 50, carbsG: 90, fatG: 15 });
    expect(totals.get('2026-11-03')).toEqual({ waterMl: 250, kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 });
  });

  test('a day with a document and no entry is at zero', () => {
    const totals = totalsFromEntries({ water: [], food: [], days: new Map([['2026-11-01', { kcal: 900 }]]) });
    expect(totals.get('2026-11-01')).toEqual({ waterMl: 0, kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 });
  });

  test('rounds the float drift of the macros', () => {
    const totals = totalsFromEntries({ water: [], food: [food('2026-11-02', 0, 0.1), food('2026-11-02', 0, 0.2)], days: new Map() });
    expect(totals.get('2026-11-02')?.proteinG).toBe(0.3);
  });
});

describe('daysToCorrect', () => {
  const right = new Map([
    ['2026-11-02', { waterMl: 750, kcal: 800, proteinG: 50, carbsG: 90, fatG: 15 }],
    ['2026-11-03', { waterMl: 0, kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 }],
  ]);

  test('keeps the days whose stored totals are wrong, and leaves the right ones', () => {
    const stored = new Map([
      ['2026-11-02', { waterMl: 750, kcal: 900, proteinG: 50, carbsG: 90, fatG: 15 }],
      ['2026-11-03', { waterMl: 0, kcal: 0 }],
    ]);
    expect([...daysToCorrect(right, stored).keys()]).toEqual(['2026-11-02']);
  });

  test('tolerates the drift the rules allow', () => {
    const stored = new Map([['2026-11-02', { waterMl: 750, kcal: 800.04, proteinG: 49.97, carbsG: 90, fatG: 15 }]]);
    expect(daysToCorrect(new Map([['2026-11-02', right.get('2026-11-02')!]]), stored).size).toBe(0);
  });

  test('a day with no document at all is corrected when it has entries', () => {
    expect([...daysToCorrect(right, new Map()).keys()]).toEqual(['2026-11-02']);
  });
});
