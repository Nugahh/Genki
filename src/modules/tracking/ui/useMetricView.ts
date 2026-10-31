import { useEffect, useState } from 'react';
import type { MetricView, TrackingUseCases } from '../application/trackingUseCases';
import type { Goals, MetricDefinition } from '../domain/metric';
import type { Period } from '../domain/period';

/**
 * The live view of a metric over a period. `view` is null until the source has answered, and again while another period loads;
 * `failed` is true when the source refused the read.
 */
export function useMetricView(tracking: TrackingUseCases, def: MetricDefinition, goals: Goals, period: Period, anchor: string): { view: MetricView | null; failed: boolean } {
  // The answer keeps the request it is for, so that a view of another period is never shown for this one.
  const { kcal, kcalMode, proteinG, waterMl, steps } = goals;
  const request = `${def.id}|${period}|${anchor}|${kcal}|${kcalMode}|${proteinG}|${waterMl}|${steps}`;
  const [answer, setAnswer] = useState<{ request: string; view?: MetricView; failed?: true } | null>(null);
  useEffect(
    // The goals are taken by value: a new object for the same goals (every profile snapshot) must not restart the listener.
    () => tracking.observeMetric(def, { kcal, kcalMode, proteinG, waterMl, steps }, period, anchor, (view) => setAnswer({ request, view }), () => setAnswer({ request, failed: true })),
    [tracking, def, kcal, kcalMode, proteinG, waterMl, steps, period, anchor, request],
  );
  const current = answer?.request === request ? answer : null;
  return { view: current?.view ?? null, failed: current?.failed === true };
}
