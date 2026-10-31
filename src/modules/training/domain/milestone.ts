import type { LoggedSet } from './workout';

export type Direction = 'up' | 'down';
export type Milestone = { id: string; metric: string; target: number; direction: Direction; label: string; achievedAt?: Date };
export type NewMilestone = Omit<Milestone, 'id' | 'achievedAt'>;

/** A milestone follows an exercise (its best set in reps, or its heaviest load) or a measure of the body (spec §9). */
export const BODY_METRICS = ['weightKg', 'waistCm'] as const;

/** The metric of an exercise: `exercise:<id>:reps` (best set) or `exercise:<id>:kg` (heaviest load). */
export const exerciseMetric = (exerciseId: string, kind: 'reps' | 'kg') => `exercise:${exerciseId}:${kind}`;

/** Whether `value` has crossed the target in the direction given (spec §9). */
export const isReached = (m: Pick<Milestone, 'target' | 'direction'>, value: number) => (m.direction === 'up' ? value >= m.target : value <= m.target);

/** The milestones, not yet achieved, that the sets of this workout cross. */
export function reachedBy(milestones: Milestone[], done: LoggedSet[]): Milestone[] {
  return milestones.filter((m) => {
    if (m.achievedAt || !m.metric.startsWith('exercise:')) return false; // the body ones are reached by a measure
    const [, exerciseId, kind] = m.metric.split(':');
    const values = done.filter((s) => s.exerciseId === exerciseId).map((s) => (kind === 'reps' ? s.reps : s.kg));
    if (values.length === 0) return false;
    return isReached(m, m.direction === 'up' ? Math.max(...values) : Math.min(...values));
  });
}

/** A French message for the first problem with a milestone, or null. */
export function validateMilestone(m: NewMilestone): string | null {
  if (m.label.trim().length === 0 || m.label.length > 100) return 'Le libellé doit faire entre 1 et 100 caractères.';
  if (!(m.target >= 0 && m.target <= 100000)) return 'La cible est comprise entre 0 et 100 000.';
  if (!/^exercise:[a-z0-9-]+:(reps|kg)$/.test(m.metric) && !(BODY_METRICS as readonly string[]).includes(m.metric)) return 'Le palier doit suivre un exercice, le poids ou le tour de taille.';
  return null;
}
