import { inMemoryFactsSource } from '../adapters/inMemoryFactsSource';
import { metricById } from '../domain/metrics';
import { trackingUseCases, type MetricView } from './trackingUseCases';

const goals = { kcal: 2000, proteinG: 100, waterMl: 2500, steps: 8000 };
const clock = { now: () => new Date('2026-10-31T10:00:00Z') }; // Saturday 31 October, 11:00 in Paris
const calories = metricById('calories')!;
const volume = metricById('volume')!;
const weight = metricById('weight')!;

function setup(days = {}, training = {}) {
  const daysSource = inMemoryFactsSource(days);
  const trainingSource = inMemoryFactsSource(training);
  const tracking = trackingUseCases({ sources: { days: daysSource, training: trainingSource }, clock, timezone: 'Europe/Paris' });
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
  const tracking = trackingUseCases({ sources: { days: failing as never, training: failing as never }, clock, timezone: 'Europe/Paris' });
  const errors: string[] = [];
  tracking.observeMetric(calories, goals, 'week', '2026-10-31', () => {}, (e) => errors.push(e.message));
  expect(errors).toEqual(['denied']);
});
