import { useEffect, useState } from 'react';
import type { MicroRow, TrackingUseCases } from '../application/trackingUseCases';
import type { Goals } from '../domain/metric';
import type { Period } from '../domain/period';
import { useStableGoals } from './useStableGoals';

/** The live rows of the 26 nutrients over a period; `rows` is null until the meals have answered, and again while another period loads. */
export function useMicronutrients(tracking: TrackingUseCases, goals: Goals, period: Period, anchor: string): { rows: MicroRow[] | null; failed: boolean } {
  const stable = useStableGoals(goals);
  const request = `${period}|${anchor}|${JSON.stringify(stable)}`;
  const [answer, setAnswer] = useState<{ request: string; rows?: MicroRow[]; failed?: true } | null>(null);
  useEffect(
    () => tracking.observeMicronutrients(stable, period, anchor, (rows) => setAnswer({ request, rows }), () => setAnswer({ request, failed: true })),
    [tracking, stable, period, anchor, request],
  );
  const current = answer?.request === request ? answer : null;
  return { rows: current?.rows ?? null, failed: current?.failed === true };
}
