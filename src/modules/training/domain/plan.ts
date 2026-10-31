export type PlannedExercise = { exerciseId: string; name: string; sets: number; reps: number; incrementKg: number };
export type PlannedSession = { name: string; exercises: PlannedExercise[] };
export type Phase = { name: string; weeks: number; sessions: PlannedSession[] };
export type Plan = {
  id: string;
  name: string;
  active: boolean;
  /** The first day of the programme (`YYYY-MM-DD`, profile time zone): the phase and the week in progress are counted from it. */
  startDay: string;
  phases: Phase[];
};
export type NewPlan = Omit<Plan, 'id'>;

/** An exercise is its name without accents, in lower case, with dashes: two programmes that name it alike share its history. */
export function exerciseIdOf(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const DAY_MS = 24 * 60 * 60 * 1000;
const isDay = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
/** Whole days from one day key to another: keys are calendar days, so UTC arithmetic has no time-zone or clock-change drift. */
const daysBetween = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS);

export type Position = { phaseIndex: number; week: number } | { finished: true };

/** Where `today` falls in the programme: the phase and the week of that phase, or finished. Before the start, it is the first week. */
export function planPosition(plan: Plan, today: string): Position {
  let weeksLeft = Math.max(0, Math.floor(daysBetween(plan.startDay, today) / 7));
  for (const [phaseIndex, phase] of plan.phases.entries()) {
    if (weeksLeft < phase.weeks) return { phaseIndex, week: weeksLeft + 1 };
    weeksLeft -= phase.weeks;
  }
  return { finished: true };
}

/** The session that follows the last one done, coming round; the first when there is none or it is not of this phase. */
export function nextSession(phase: Phase, lastSessionName?: string): PlannedSession {
  const last = phase.sessions.findIndex((s) => s.name === lastSessionName);
  return phase.sessions[(last + 1) % phase.sessions.length];
}

const isShort = (text: string) => text.trim().length > 0 && text.length <= 100;
const isInt = (n: number, min: number, max: number) => Number.isInteger(n) && n >= min && n <= max;

/** A French message for the first problem with an exercise, or null. */
export function validateExercise(exercise: PlannedExercise): string | null {
  if (!isShort(exercise.name)) return 'Le nom d’un exercice doit faire entre 1 et 100 caractères.';
  if (!exercise.exerciseId) return 'Le nom d’un exercice doit contenir au moins une lettre ou un chiffre.';
  if (!isInt(exercise.sets, 1, 20)) return 'Un exercice a entre 1 et 20 séries.';
  if (!isInt(exercise.reps, 1, 1000)) return 'Un exercice a entre 1 et 1 000 répétitions.';
  if (!(exercise.incrementKg >= 0 && exercise.incrementKg <= 50)) return 'L’incrément de charge est compris entre 0 et 50 kg.';
  return null;
}

/** A French message for the first problem with a programme, or null. The bounds are those of the Firestore rules, which check the sizes of the lists. */
export function validatePlan(plan: NewPlan): string | null {
  if (!isShort(plan.name)) return 'Le nom du programme doit faire entre 1 et 100 caractères.';
  if (!isDay(plan.startDay)) return 'Le jour de début du programme n’est pas valide.';
  if (plan.phases.length < 1 || plan.phases.length > 12) return 'Un programme a entre 1 et 12 phases.';
  for (const phase of plan.phases) {
    if (!isShort(phase.name)) return 'Le nom d’une phase doit faire entre 1 et 100 caractères.';
    if (!isInt(phase.weeks, 1, 52)) return 'Une phase dure entre 1 et 52 semaines.';
    if (phase.sessions.length < 1 || phase.sessions.length > 14) return 'Une phase a entre 1 et 14 séances.';
    for (const session of phase.sessions) {
      if (!isShort(session.name)) return 'Le nom d’une séance doit faire entre 1 et 100 caractères.';
      if (session.exercises.length < 1 || session.exercises.length > 20) return 'Une séance a entre 1 et 20 exercices.';
      for (const exercise of session.exercises) {
        const problem = validateExercise(exercise);
        if (problem) return problem;
      }
      if (new Set(session.exercises.map((e) => e.exerciseId)).size < session.exercises.length) return 'Deux exercices d’une séance ne peuvent pas porter le même nom.';
    }
  }
  return null;
}

/** Where an exercise sits: its phase, its session in that phase, and its place in the session. */
export type ExerciseAt = { phase: number; session: number; exercise: number };

const mapSession = (plan: Plan, at: { phase: number; session: number }, change: (exercises: PlannedExercise[]) => PlannedExercise[]): Plan => ({
  ...plan,
  phases: plan.phases.map((phase, p) =>
    p !== at.phase ? phase : { ...phase, sessions: phase.sessions.map((session, s) => (s !== at.session ? session : { ...session, exercises: change(session.exercises) })) },
  ),
});

/** The programme with one exercise changed. The programme it comes from is left alone. */
export const replaceExercise = (plan: Plan, at: ExerciseAt, exercise: PlannedExercise): Plan => mapSession(plan, at, (list) => list.map((e, i) => (i === at.exercise ? exercise : e)));

/** The programme with an exercise added at the end of a session. */
export const withAddedExercise = (plan: Plan, at: { phase: number; session: number }, exercise: PlannedExercise): Plan => mapSession(plan, at, (list) => [...list, exercise]);

/** The programme without one exercise; a session keeps at least one, so the last is never removed. */
export const withoutExercise = (plan: Plan, at: ExerciseAt): Plan => mapSession(plan, at, (list) => (list.length > 1 ? list.filter((_, i) => i !== at.exercise) : list));

export const renamed = (plan: Plan, name: string): Plan => ({ ...plan, name });
