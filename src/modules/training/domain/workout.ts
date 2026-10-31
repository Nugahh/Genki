export type LoggedSet = { exerciseId: string; setNo: number; reps: number; kg: number };
export type WorkoutLog = {
  id: string;
  day: string;
  planId: string;
  sessionName: string;
  /** The distinct exercises of the workout: the field the « last time » query looks in (spec §4 rule 6). */
  exerciseIds: string[];
  sets: LoggedSet[];
  durationMin: number;
  createdAt: Date;
};
export type NewWorkoutLog = Omit<WorkoutLog, 'id'>;

/** A French message for the first problem with a workout, or null. The bounds are those of the Firestore rules, which check the sizes of the lists. */
export function validateWorkout(log: NewWorkoutLog): string | null {
  if (log.sets.length < 1) return 'Une séance a au moins une série.';
  for (const set of log.sets) {
    if (!Number.isInteger(set.setNo) || set.setNo < 1) return 'Le numéro d’une série commence à 1.';
    if (!Number.isInteger(set.reps) || set.reps < 0 || set.reps > 1000) return 'Les répétitions sont comprises entre 0 et 1 000.';
    if (!(set.kg >= 0 && set.kg <= 1000)) return 'La charge est comprise entre 0 et 1 000 kg.';
  }
  return null;
}
