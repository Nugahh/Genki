export type GaugeColor = 'green' | 'orange' | 'red';

/** Share of the daily goal expected by `hour`: the active day runs from 7 h to 23 h (spec §9). */
export function expectedProgress(hour: number): number {
  return Math.min(Math.max((hour - 7) / 16, 0), 1);
}

/** Gauge color from the pace, actual progress / expected progress (spec §9). */
export function paceColor(value: number, goal: number, hour: number): GaugeColor {
  const expected = expectedProgress(hour);
  if (expected === 0 || goal <= 0) return 'green';
  const pace = value / goal / expected;
  if (pace >= 0.9) return 'green';
  return pace >= 0.6 ? 'orange' : 'red';
}
