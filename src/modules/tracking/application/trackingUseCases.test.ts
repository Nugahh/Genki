import type { DayFacts } from '../domain/metric';
import { inMemoryFactsSource } from '../adapters/inMemoryFactsSource';
import { metricById } from '../domain/metrics';
import { trackingUseCases, type MetricView } from './trackingUseCases';

const goals = { kcal: 2000, proteinG: 100, waterMl: 2500, steps: 8000 };
const clock = { now: () => new Date('2026-10-31T10:00:00Z') }; // Saturday 31 October, 11:00 in Paris
const calories = metricById('calories')!;
const volume = metricById('volume')!;

function setup(days = {}, training = {}) {
  const daysSource = inMemoryFactsSource(days);
  const trainingSource = inMemoryFactsSource(training);
  const tracking = trackingUseCases({ sources: [daysSource, trainingSource], goals, clock, timezone: 'Europe/Paris' });
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
  tracking.observeMetric(calories, 'week', '2026-10-31', (view) => views.push(view), () => {});

  expect(daysSource.ranges).toEqual([['2026-10-19', '2026-11-01']]);
  const view = views[0];
  expect(view.points).toHaveLength(7);
  expect(view.points[0]).toMatchObject({ value: 2000, tone: 'good' });
  expect(view.summary).toMatchObject({ average: 1950, daysInTarget: 2, daysCounted: 2 });
  expect(view.previous.average).toBe(1800);
  expect(view.headline).toBe(1950);
  expect(view.change).toBe(150);
  expect(view.goal).toBe(2000);
});

test('merges the facts of every source for a day', () => {
  const { tracking, views } = setup({ '2026-10-26': { kcal: 2000 } }, { '2026-10-26': { volumeKg: 3000, sessions: 1 } });
  tracking.observeMetric(volume, 'week', '2026-10-31', (view) => views.push(view), () => {});
  expect(views[0].points[0].value).toBe(3000);
  expect(views[0].goal).toBeUndefined();
});

test('shows the day itself in the day view, against the day before', () => {
  const { tracking, views } = setup({ '2026-10-30': { kcal: 1800 }, '2026-10-31': { kcal: 900 } });
  tracking.observeMetric(calories, 'day', '2026-10-31', (view) => views.push(view), () => {});
  expect(views[0]).toMatchObject({ headline: 900, change: -900 });
  expect(views[0].points[0]).toMatchObject({ partial: true });
});

test('follows the sources as they change, and stops with the unsubscribe', () => {
  const { daysSource, trainingSource, tracking, views } = setup();
  const stop = tracking.observeMetric(calories, 'week', '2026-10-31', (view) => views.push(view), () => {});
  expect(views).toHaveLength(1);
  daysSource.set({ '2026-10-26': { kcal: 1000 } });
  expect(views[1].points[0].value).toBe(1000);
  stop();
  expect([daysSource.observers, trainingSource.observers]).toEqual([0, 0]);
});

test('waits for every source before it shows anything', () => {
  const late: ((facts: Map<string, DayFacts>) => void)[] = [];
  const slow = { observeRange: (_from: string, _to: string, onNext: (facts: Map<string, DayFacts>) => void) => (late.push(onNext), () => {}) };
  const tracking = trackingUseCases({ sources: [inMemoryFactsSource(), slow], goals, clock, timezone: 'Europe/Paris' });
  const seen: MetricView[] = [];
  tracking.observeMetric(calories, 'week', '2026-10-31', (view) => seen.push(view), () => {});
  expect(seen).toHaveLength(0);
  late[0](new Map());
  expect(seen).toHaveLength(1);
});

test('passes a source error on', () => {
  const failing = { observeRange: (_from: string, _to: string, _next: unknown, onError: (e: Error) => void) => (onError(new Error('denied')), () => {}) };
  const tracking = trackingUseCases({ sources: [failing as never], goals, clock, timezone: 'Europe/Paris' });
  const errors: string[] = [];
  tracking.observeMetric(calories, 'week', '2026-10-31', () => {}, (e) => errors.push(e.message));
  expect(errors).toEqual(['denied']);
});
