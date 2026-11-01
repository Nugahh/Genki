import { inMemoryFactsSource } from '../adapters/inMemoryFactsSource';
import type { DayFacts } from '../domain/metric';
import { metricById } from '../domain/metrics';
import { trackingUseCases, type MetricView, type MicroRow } from './trackingUseCases';

const goals = { kcal: 2000, proteinG: 100, waterMl: 2500, steps: 8000 };
const clock = { now: () => new Date('2026-10-31T10:00:00Z') }; // Saturday 31 October, 11:00 in Paris
const calories = metricById('calories')!;
const volume = metricById('volume')!;
const weight = metricById('weight')!;

function setup(days = {}, training = {}) {
  const daysSource = inMemoryFactsSource(days);
  const trainingSource = inMemoryFactsSource(training);
  const tracking = trackingUseCases({ sources: { days: daysSource, training: trainingSource, tobacco: inMemoryFactsSource(), meals: inMemoryFactsSource() }, clock, timezone: 'Europe/Paris' });
  const views: MetricView[] = [];
  return { daysSource, trainingSource, tracking, views };
}

test('reads the period and the one before it, and builds the points, the summary and the change', () => {
  const { daysSource, tracking, views } = setup({
    '2026-10-19': { kcal: 1800 }, // last week
    '2026-10-26': { kcal: 2000 },
    '2026-10-27': { kcal: 1900 },
    '2026-10-31': { kcal: 500 }, // today: not counted
  });
  tracking.observeMetric(calories, goals, 'week', '2026-10-31', (view) => views.push(view), () => {});

  expect(daysSource.ranges).toEqual([['2026-10-19', '2026-11-01']]);
  const view = views[0];
  expect(view.points).toHaveLength(7);
  expect(view.points[0]).toMatchObject({ value: 2000, tone: 'good' });
  expect(view.summary).toMatchObject({ average: 1950, daysInTarget: 2, daysCounted: 2 });
  expect(view.headline).toBe(1950);
  expect(view.change).toBe(150);
  expect(view.goal).toBe(2000);
});

test('a metric listens to its own source only', () => {
  const { daysSource, trainingSource, tracking, views } = setup({ '2026-10-26': { kcal: 2000 } }, { '2026-10-26': { volumeKg: 3000, sessions: 1 } });
  tracking.observeMetric(volume, goals, 'week', '2026-10-31', (view) => views.push(view), () => {});
  expect(views[0].points[0].value).toBe(3000);
  expect(views[0].goal).toBeUndefined();
  expect(daysSource.observers).toBe(0);
  expect(trainingSource.observers).toBe(1);
});

test('compares a measure with the day before in the day view, but not a total still adding up', () => {
  const { tracking, views } = setup({ '2026-10-30': { kcal: 1800, weightKg: 80 }, '2026-10-31': { kcal: 150, weightKg: 79.5 } });
  tracking.observeMetric(weight, goals, 'day', '2026-10-31', (view) => views.push(view), () => {});
  tracking.observeMetric(calories, goals, 'day', '2026-10-31', (view) => views.push(view), () => {});
  expect(views[0]).toMatchObject({ headline: 79.5, change: -0.5 });
  expect(views[1].headline).toBe(150);
  expect(views[1].change).toBeUndefined();
  expect(views[1].points[0]).toMatchObject({ partial: true });
});

test('follows the source as it changes, and stops with the unsubscribe', () => {
  const { daysSource, tracking, views } = setup();
  const stop = tracking.observeMetric(calories, goals, 'week', '2026-10-31', (view) => views.push(view), () => {});
  expect(views).toHaveLength(1);
  daysSource.set({ '2026-10-26': { kcal: 1000 } });
  expect(views[1].points[0].value).toBe(1000);
  stop();
  expect(daysSource.observers).toBe(0);
});

test('shares the energy of the nutrition metrics only', () => {
  const { tracking, views } = setup({ '2026-10-26': { kcal: 2000, proteinG: 100, carbsG: 200, fatG: 50 } });
  tracking.observeMetric(calories, goals, 'week', '2026-10-31', (view) => views.push(view), () => {});
  tracking.observeMetric(weight, goals, 'week', '2026-10-31', (view) => views.push(view), () => {});
  expect(views[0].split).toEqual({ proteinPct: 24, carbsPct: 48, fatPct: 27 });
  expect(views[1].split).toBeUndefined();
});

test('passes a source error on', () => {
  const failing = { observeRange: (_from: string, _to: string, _next: unknown, onError: (e: Error) => void) => (onError(new Error('denied')), () => {}) };
  const tracking = trackingUseCases({ sources: { days: failing as never, training: failing as never, tobacco: failing as never, meals: failing as never }, clock, timezone: 'Europe/Paris' });
  const errors: string[] = [];
  tracking.observeMetric(calories, goals, 'week', '2026-10-31', () => {}, (e) => errors.push(e.message));
  expect(errors).toEqual(['denied']);
});

describe('observeMicronutrients', () => {
  const refs = { ...goals, nutrients: { vitC: 110, iron: 11, salt: 5 } };
  const MEALS = {
    '2026-10-26': { nutrients: { iron: 11, vitC: 55, salt: 4 }, incomplete: ['zinc'] },
    '2026-10-27': { nutrients: { iron: 5.5, vitC: 55, salt: 7 }, incomplete: ['iron', 'zinc'] },
    '2026-10-31': { nutrients: { iron: 1, vitC: 10 }, incomplete: ['salt'] }, // today
  };
  function observe(period: 'day' | 'week', anchor: string, goalsOf: typeof goals = refs, facts: Record<string, DayFacts> = MEALS) {
    const meals = inMemoryFactsSource(facts);
    const tracking = trackingUseCases({ sources: { days: inMemoryFactsSource(), training: inMemoryFactsSource(), tobacco: inMemoryFactsSource(), meals }, clock, timezone: 'Europe/Paris' });
    const rows: MicroRow[][] = [];
    tracking.observeMicronutrients(goalsOf, period, anchor, (list) => rows.push(list), () => {});
    const row = (id: string) => rows[0].find((r) => r.info.id === id)!;
    return { meals, rows, row };
  }

  test('one read of the meals feeds the 26 rows', () => {
    const { meals, rows } = observe('week', '2026-10-31');
    expect(meals.ranges).toEqual([['2026-10-26', '2026-11-01']]);
    expect(rows[0]).toHaveLength(26);
    expect(rows[0].map((r) => r.info.id)[0]).toBe('vitA');
  });

  test('a week is the mean of its finished days, against the reference', () => {
    const { row } = observe('week', '2026-10-31');
    expect(row('iron')).toMatchObject({ value: 8.25, reference: 11, pct: 75, tone: 'none', incomplete: true });
    expect(row('vitC')).toMatchObject({ value: 55, pct: 50, tone: 'bad', incomplete: false });
    // Today's gap (no salt in a meal of today) does not make the mean of the finished days partial.
    expect(row('salt')).toMatchObject({ value: 5.5, pct: 110, tone: 'warn', incomplete: false });
    // Meals, none of which tells the zinc: at least 0, and no reference to measure it against here.
    expect(row('zinc')).toMatchObject({ value: 0, pct: undefined, tone: 'none', incomplete: true });
  });

  test('a day is its own total; today so far has no tone', () => {
    expect(observe('day', '2026-10-26').row('iron')).toMatchObject({ value: 11, pct: 100, tone: 'good' });
    expect(observe('day', '2026-10-27').row('iron')).toMatchObject({ value: 5.5, pct: 50, tone: 'none', incomplete: true });
    expect(observe('day', '2026-10-31').row('vitC')).toMatchObject({ value: 10, pct: 9, tone: 'none' });
  });

  test('a finished day with meals that lack a nutrient counts 0 for it: the mean stays a lower bound', () => {
    const { row } = observe('week', '2026-10-31', refs, {
      '2026-10-26': { nutrients: { iron: 11 }, incomplete: [] },
      '2026-10-27': { nutrients: {}, incomplete: ['iron'] },
    });
    expect(row('iron')).toMatchObject({ value: 5.5, incomplete: true, tone: 'none' });
  });

  test('without references there is a total and no percentage', () => {
    const { row } = observe('day', '2026-10-26', goals);
    expect(row('iron')).toMatchObject({ value: 11, reference: undefined, pct: undefined, tone: 'none' });
  });
});
