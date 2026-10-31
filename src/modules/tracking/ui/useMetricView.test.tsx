import { act, renderHook } from '@testing-library/react-native';
import { inMemoryFactsSource } from '../adapters/inMemoryFactsSource';
import { trackingUseCases } from '../application/trackingUseCases';
import type { DayFacts } from '../domain/metric';
import { metricById } from '../domain/metrics';
import type { Period } from '../domain/period';
import { useMetricView } from './useMetricView';

const calories = metricById('calories')!;
const clock = { now: () => new Date('2026-10-31T10:00:00Z') };
const goals = { kcal: 2000, proteinG: 100, waterMl: 2500, steps: 8000 };

function slowSource() {
  const answers: { onNext: (facts: Map<string, DayFacts>) => void; onError: (e: Error) => void }[] = [];
  return { answers, source: { observeRange: (_from: string, _to: string, onNext: (facts: Map<string, DayFacts>) => void, onError: (e: Error) => void) => (answers.push({ onNext, onError }), () => {}) } };
}

test('never shows the answer for another period while this one is still loading', async () => {
  const { answers, source } = slowSource();
  const tracking = trackingUseCases({ sources: { days: source, training: inMemoryFactsSource() }, clock, timezone: 'Europe/Paris' });
  const { result, rerender } = await renderHook((props: { period: Period }) => useMetricView(tracking, calories, goals, props.period, '2026-10-31'), { initialProps: { period: 'week' as Period } });
  expect(result.current).toEqual({ view: null, failed: false });

  await act(async () => answers[0].onNext(new Map()));
  expect(result.current.view).not.toBeNull();

  await rerender({ period: 'year' });
  expect(result.current).toEqual({ view: null, failed: false }); // the week's answer is not the year's

  await act(async () => answers[1].onNext(new Map()));
  expect(result.current.view?.points).toHaveLength(12);
});

test('says when the source refuses the read, and recovers on the next period', async () => {
  const { answers, source } = slowSource();
  const tracking = trackingUseCases({ sources: { days: source, training: inMemoryFactsSource() }, clock, timezone: 'Europe/Paris' });
  const { result, rerender } = await renderHook((props: { period: Period }) => useMetricView(tracking, calories, goals, props.period, '2026-10-31'), { initialProps: { period: 'week' as Period } });
  await act(async () => answers[0].onError(new Error('denied')));
  expect(result.current).toEqual({ view: null, failed: true });
  await rerender({ period: 'year' });
  expect(result.current.failed).toBe(false);
});
