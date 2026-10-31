import { useEffect, useState } from 'react';
import type { MetricView, TrackingUseCases } from '../application/trackingUseCases';
import type { MetricDefinition } from '../domain/metric';
import type { Period } from '../domain/period';

/** The live view of a metric over a period; null until the sources have answered, and again while another period loads. */
export function useMetricView(tracking: TrackingUseCases, def: MetricDefinition, period: Period, anchor: string): MetricView | null {
  const [view, setView] = useState<MetricView | null>(null);
  useEffect(() => {
    setView(null);
    // Listener errors show on the SyncIcon, which watches the same user's data.
    return tracking.observeMetric(def, period, anchor, setView, () => {});
  }, [tracking, def, period, anchor]);
  return view;
}
