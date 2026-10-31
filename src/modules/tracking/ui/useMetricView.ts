import { useEffect, useState } from 'react';
import type { MetricView, TrackingUseCases } from '../application/trackingUseCases';
import type { MetricDefinition } from '../domain/metric';
import type { Period } from '../domain/period';

/** The live view of a metric over a period; null until the sources have answered, and again while another period loads. */
export function useMetricView(tracking: TrackingUseCases, def: MetricDefinition, period: Period, anchor: string): MetricView | null {
  // The view keeps the request it answers, so that a view of another period is never shown for this one.
  const request = `${def.id}|${period}|${anchor}`;
  const [answer, setAnswer] = useState<{ request: string; view: MetricView } | null>(null);
  useEffect(
    // Listener errors show on the SyncIcon, which watches the same user's data.
    () => tracking.observeMetric(def, period, anchor, (view) => setAnswer({ request, view }), () => {}),
    [tracking, def, period, anchor, request],
  );
  return answer?.request === request ? answer.view : null;
}
