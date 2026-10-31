/** The measures of a day: both optional, one value a day each (spec §4 rule 8). */
export type Measure = { weightKg?: number; waistCm?: number };

/** The mean of the values that exist, over the days given (the last seven: the rolling mean of spec §9); nothing when none exists. */
export function rollingMean(values: (number | undefined)[]): number | undefined {
  const present = values.filter((v): v is number => v !== undefined);
  return present.length > 0 ? present.reduce((sum, v) => sum + v, 0) / present.length : undefined;
}

const within = (n: number | undefined, min: number, max: number) => n === undefined || (Number.isFinite(n) && n >= min && n <= max);

/** A French message for the first problem with a measure, or null. The bounds are those of the Firestore rules. */
export function validateMeasure(measure: Measure): string | null {
  if (measure.weightKg === undefined && measure.waistCm === undefined) return 'Saisis au moins une mesure.';
  if (!within(measure.weightKg, 20, 400)) return 'Le poids est compris entre 20 et 400 kg.';
  if (!within(measure.waistCm, 30, 300)) return 'Le tour de taille est compris entre 30 et 300 cm.';
  return null;
}

/** The milestone metrics of the body (spec §9): the last value of the measure crosses the target. */
export const BODY_METRICS = { weightKg: 'weightKg', waistCm: 'waistCm' } as const;

type BodyMilestone = { id: string; metric: string; target: number; direction: 'up' | 'down'; achievedAt?: Date };

/** The milestones, not yet achieved, that a measure crosses. */
export function reachedByMeasure(milestones: BodyMilestone[], measure: Measure): string[] {
  return milestones
    .filter((m) => {
      if (m.achievedAt) return false;
      const value = m.metric === BODY_METRICS.weightKg ? measure.weightKg : m.metric === BODY_METRICS.waistCm ? measure.waistCm : undefined;
      if (value === undefined) return false;
      return m.direction === 'up' ? value >= m.target : value <= m.target;
    })
    .map((m) => m.id);
}
