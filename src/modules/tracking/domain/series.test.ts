import type { DayFacts, Goals } from './metric';
import { DEFAULT_HUB, METRICS, SECTIONS, metricById, metricsOf } from './metrics';
import { bucketsFor, rangeOf } from './period';
import { headline, inTarget, macroSplit, seriesFor, summarize, toneOf, variation } from './series';

const goals: Goals = { kcal: 2000, proteinG: 100, waterMl: 2500, steps: 8000 };
const calories = metricById('calories')!;
const protein = metricById('protein')!;
const weight = metricById('weight')!;
const facts = (entries: Record<string, DayFacts>) => new Map(Object.entries(entries));
const TODAY = '2026-10-31'; // a Saturday
const WEEK = bucketsFor('week', TODAY); // Mon 26 October to Sun 1 November

describe('the registry', () => {
  test('has unique ids, a section for each metric, and a hub made of known metrics', () => {
    expect(new Set(METRICS.map((m) => m.id)).size).toBe(METRICS.length);
    expect(DEFAULT_HUB.every((id) => metricById(id))).toBe(true);
    expect(SECTIONS.every((s) => metricsOf(s.id).length > 0)).toBe(true);
  });
});

describe('toneOf', () => {
  test.each([
    [0.5, 'bad'],
    [0.59, 'bad'],
    [0.6, 'warn'],
    [0.89, 'warn'],
    [0.9, 'good'],
    [1.3, 'good'],
  ] as const)('protein at %s of the goal is %s', (ratio, tone) => expect(toneOf(protein, goals, ratio * 100)).toBe(tone));

  test.each([
    [0.5, 'bad'],
    [0.7, 'warn'],
    [0.9, 'good'],
    [1.05, 'good'],
    [1.08, 'warn'],
    [1.1, 'warn'],
    [1.12, 'bad'],
  ] as const)('calories at %s of the goal are %s: too much is not on target', (ratio, tone) => expect(toneOf(calories, goals, ratio * 2000)).toBe(tone));

  test('a metric with no goal to hit has no tone', () => {
    expect(toneOf(weight, goals, 80)).toBe('none');
    expect(inTarget(weight, goals, 80)).toBe(false);
  });
});

describe('seriesFor', () => {
  const week = seriesFor(
    calories,
    goals,
    WEEK,
    facts({ '2026-10-26': { kcal: 1900 }, '2026-10-27': { kcal: 2400 }, '2026-10-28': { kcal: 1500 }, '2026-10-31': { kcal: 1200 } }),
    TODAY,
  );

  test('a finished day has its value and its tone', () => {
    expect(week[0]).toMatchObject({ value: 1900, partial: false, tone: 'good' });
    expect(week[1]).toMatchObject({ value: 2400, partial: false, tone: 'bad' });
    expect(week[2]).toMatchObject({ value: 1500, partial: false, tone: 'warn' });
  });

  test('a day with no record has no value', () => expect(week[3]).toMatchObject({ value: undefined, partial: false, tone: 'none' }));

  test('today is only partial, with its value so far and no tone', () => expect(week[5]).toMatchObject({ value: 1200, partial: true, tone: 'none' }));

  test('a day to come has nothing', () => expect(week[6]).toMatchObject({ value: undefined, partial: false, tone: 'none' }));

  test('a month is the mean of its finished days that have a value, and today does not count', () => {
    const year = seriesFor(calories, goals, bucketsFor('year', TODAY), facts({ '2026-10-01': { kcal: 2000 }, '2026-10-02': { kcal: 1000 }, '2026-10-31': { kcal: 3000 } }), TODAY);
    expect(year[9]).toMatchObject({ value: 1500, partial: false, tone: 'warn' });
    expect(year[10]).toMatchObject({ value: undefined, partial: false });
    expect(year[0].value).toBeUndefined();
  });

  test('a month that holds only today is partial', () => {
    const year = seriesFor(calories, goals, bucketsFor('year', '2026-11-01'), facts({ '2026-11-01': { kcal: 800 } }), '2026-11-01');
    expect(year[10]).toMatchObject({ value: 800, partial: true, tone: 'none' });
  });
});

describe('summarize', () => {
  const range = rangeOf(WEEK);
  const days = facts({ '2026-10-26': { kcal: 1900 }, '2026-10-27': { kcal: 2400 }, '2026-10-28': { kcal: 1500 }, '2026-10-31': { kcal: 100 } });

  test('counts the finished days only: the average, the days on target, the days counted', () => {
    const summary = summarize(calories, goals, range, days, TODAY);
    expect(summary.average).toBeCloseTo(1933.33, 1);
    expect(summary).toMatchObject({ daysInTarget: 1, daysCounted: 3 });
  });

  test('the best day of calories is the one closest to the goal, the best of an "at least" metric is the highest', () => {
    expect(summarize(calories, goals, range, days, TODAY).best).toEqual({ day: '2026-10-26', value: 1900 });
    const grams = facts({ '2026-10-26': { proteinG: 80 }, '2026-10-27': { proteinG: 120 } });
    expect(summarize(protein, goals, range, grams, TODAY).best).toEqual({ day: '2026-10-27', value: 120 });
  });

  test('has no best day for a metric with no target', () => {
    expect(summarize(weight, goals, range, facts({ '2026-10-26': { weightKg: 80 } }), TODAY)).toMatchObject({ average: 80, daysInTarget: 0, daysCounted: 1, best: undefined });
  });

  test('is empty when nothing was recorded', () => expect(summarize(calories, goals, range, facts({}), TODAY)).toEqual({ average: undefined, daysInTarget: 0, daysCounted: 0, best: undefined }));
});

describe('variation and headline', () => {
  test('the difference between two periods, or nothing when one is missing', () => {
    expect(variation(2000, 1800)).toBe(200);
    expect(variation(undefined, 1800)).toBeUndefined();
    expect(variation(2000, undefined)).toBeUndefined();
  });

  test('the headline is the average of the finished days, or the value of the day in the day view', () => {
    const points = seriesFor(calories, goals, bucketsFor('day', TODAY), facts({ [TODAY]: { kcal: 1200 } }), TODAY);
    expect(headline('day', points, { daysInTarget: 0, daysCounted: 0 })).toBe(1200);
    expect(headline('week', points, { average: 1900, daysInTarget: 1, daysCounted: 1 })).toBe(1900);
  });
});

describe('macroSplit', () => {
  test('shares the energy between protein and carbs at 4 kcal per gram and fat at 9, over the finished days', () => {
    const days = facts({ '2026-10-26': { proteinG: 100, carbsG: 200, fatG: 50 }, '2026-10-31': { proteinG: 999, carbsG: 999, fatG: 999 } });
    expect(macroSplit(rangeOf(WEEK), days, TODAY)).toEqual({ proteinPct: 24, carbsPct: 48, fatPct: 27 });
  });

  test('is undefined with no macros', () => expect(macroSplit(rangeOf(WEEK), facts({}), TODAY)).toBeUndefined());
});
