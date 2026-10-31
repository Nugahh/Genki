import type { DayFacts, Goals, MetricDefinition, Point, Summary, Tone } from './metric';
import { addDays, type Bucket, type Period } from './period';

/** How a value compares with the goal of its metric (spec §9, "Couleur des graphiques"). */
export function toneOf(def: MetricDefinition, goals: Goals, value: number): Tone {
  const goal = def.goal?.(goals);
  if (def.target === 'none' || !goal) return 'none';
  const ratio = value / goal;
  if (def.target === 'calories') {
    if (ratio >= 0.9 && ratio <= 1.05) return 'good';
    return (ratio >= 0.6 && ratio < 0.9) || (ratio > 1.05 && ratio <= 1.1) ? 'warn' : 'bad';
  }
  if (ratio >= 0.9) return 'good';
  return ratio >= 0.6 ? 'warn' : 'bad';
}

export const inTarget = (def: MetricDefinition, goals: Goals, value: number) => toneOf(def, goals, value) === 'good';

const mean = (values: number[]) => values.reduce((sum, v) => sum + v, 0) / values.length;

/** The days of `from..to` that are over, with the value the metric has on them. Today is not over. */
function finishedValues(def: MetricDefinition, from: string, to: string, facts: Map<string, DayFacts>, today: string) {
  const values: { day: string; value: number }[] = [];
  for (let day = from; day <= to && day < today; day = addDays(day, 1)) {
    const value = def.value(facts.get(day) ?? {});
    if (value !== undefined) values.push({ day, value });
  }
  return values;
}

/**
 * One point per bucket: the mean of its finished days that have a value. A bucket that holds only today with a value gets that
 * value and is `partial` (drawn dashed, with no tone: the day is not over); days to come have nothing.
 */
export function seriesFor(def: MetricDefinition, goals: Goals, buckets: Bucket[], facts: Map<string, DayFacts>, today: string): Point[] {
  return buckets.map((bucket) => {
    const done = finishedValues(def, bucket.from, bucket.to, facts, today);
    if (done.length > 0) {
      const value = mean(done.map((d) => d.value));
      return { bucket, value, partial: false, tone: toneOf(def, goals, value) };
    }
    const sofar = bucket.from <= today && today <= bucket.to ? def.value(facts.get(today) ?? {}) : undefined;
    return { bucket, value: sofar, partial: sofar !== undefined, tone: 'none' };
  });
}

/** Average, days on target and best day over the finished days of a range. The best of calories is the day closest to the goal. */
export function summarize(def: MetricDefinition, goals: Goals, range: { from: string; to: string }, facts: Map<string, DayFacts>, today: string): Summary {
  const days = finishedValues(def, range.from, range.to, facts, today);
  const goal = def.goal?.(goals);
  const score = (value: number) => (def.target === 'calories' && goal ? -Math.abs(value - goal) : value);
  const best = def.target === 'none' ? undefined : days.reduce<{ day: string; value: number } | undefined>((top, d) => (!top || score(d.value) > score(top.value) ? d : top), undefined);
  return {
    average: days.length > 0 ? mean(days.map((d) => d.value)) : undefined,
    daysInTarget: days.filter((d) => inTarget(def, goals, d.value)).length,
    daysCounted: days.length,
    best,
  };
}

/** The change from one period to the one before; nothing when either has no value. */
export const variation = (current?: number, previous?: number) => (current === undefined || previous === undefined ? undefined : current - previous);

/** The number a card shows: the day's own value in the day view (today's included), else the average of the finished days. */
export const headline = (period: Period, points: Point[], summary: Summary) => (period === 'day' ? points[0]?.value : summary.average);

/** The share of the energy that comes from protein, carbs and fat (4, 4 and 9 kcal per gram) over the finished days of a range. */
export function macroSplit(range: { from: string; to: string }, facts: Map<string, DayFacts>, today: string) {
  let protein = 0;
  let carbs = 0;
  let fat = 0;
  for (let day = range.from; day <= range.to && day < today; day = addDays(day, 1)) {
    const f = facts.get(day);
    protein += f?.proteinG ?? 0;
    carbs += f?.carbsG ?? 0;
    fat += f?.fatG ?? 0;
  }
  const kcal = { protein: protein * 4, carbs: carbs * 4, fat: fat * 9 };
  const total = kcal.protein + kcal.carbs + kcal.fat;
  if (total === 0) return undefined;
  return { proteinPct: Math.round((kcal.protein / total) * 100), carbsPct: Math.round((kcal.carbs / total) * 100), fatPct: Math.round((kcal.fat / total) * 100) };
}
