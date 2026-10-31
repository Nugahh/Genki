import type { PlannedExercise } from './plan';
import type { LoggedSet } from './workout';

const round = (kg: number) => Math.round(kg * 100) / 100;
const heaviest = (sets: LoggedSet[]) => sets.reduce((max, s) => Math.max(max, s.kg), 0);

/** The load for the next time (spec §9): the heaviest load done, plus the increment when every planned set reached the planned reps, else the same. */
export function suggestedKg(last: LoggedSet[], exercise: PlannedExercise): number {
  if (last.length === 0) return 0;
  const succeeded = last.length >= exercise.sets && last.every((s) => s.reps >= exercise.reps);
  return round(heaviest(last) + (succeeded ? exercise.incrementKg : 0));
}

export type DraftSet = { kg: number; reps: number };

/** The sets to fill in: the planned number, at the planned reps, on the load to aim for. */
export function prefillSets(exercise: PlannedExercise, last: LoggedSet[]): DraftSet[] {
  const kg = suggestedKg(last, exercise);
  return Array.from({ length: exercise.sets }, () => ({ kg, reps: exercise.reps }));
}

export type Suggestion = { exerciseId: string; name: string; fromKg: number; toKg: number };

/** The exercises of a finished workout whose load goes up next time. */
export function suggestionsFor(exercises: PlannedExercise[], done: LoggedSet[]): Suggestion[] {
  return exercises.flatMap((exercise) => {
    const sets = done.filter((s) => s.exerciseId === exercise.exerciseId);
    if (sets.length === 0) return [];
    const fromKg = heaviest(sets);
    const toKg = suggestedKg(sets, exercise);
    return toKg > fromKg ? [{ exerciseId: exercise.exerciseId, name: exercise.name, fromKg, toKg }] : [];
  });
}
