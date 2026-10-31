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

/** Calories above 105 % of the goal (spec §9): the gauge then reports the overshoot, not the pace. */
export const isOverGoal = (value: number, goal: number) => goal > 0 && value / goal > 1.05;

/** What the calories goal is for; it decides which way the gauge counts as late (the settings module's `GoalMode`, redeclared: a domain imports nothing). */
export type CalorieMode = 'deficit' | 'maintenance' | 'surplus';

/**
 * Calories (spec §9, and the goal mode chosen in the settings). Maintenance: above 110 % of the goal is red, above 105 % orange,
 * otherwise the pace decides. Deficit: eating less is not late, only going over counts. Surplus: the pace alone, going over is fine.
 */
export function calorieColor(value: number, goal: number, hour: number, mode: CalorieMode = 'maintenance'): GaugeColor {
  if (mode === 'surplus') return paceColor(value, goal, hour);
  if (goal > 0 && value / goal > 1.1) return 'red';
  if (isOverGoal(value, goal)) return 'orange';
  return mode === 'deficit' ? 'green' : paceColor(value, goal, hour);
}
