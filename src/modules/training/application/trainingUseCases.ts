import { dayKey, type Clock } from '@/shared/clock';
import { withTimeout } from '@/shared/withTimeout';
import { reachedBy, validateMilestone, type Milestone, type NewMilestone } from '../domain/milestone';
import { validatePlan, type Plan, type PlannedExercise, type PlannedSession } from '../domain/plan';
import { prefillSets, suggestionsFor, type DraftSet, type Suggestion } from '../domain/progression';
import { starterPlan } from '../domain/template';
import { validateWorkout, type LoggedSet, type NewWorkoutLog, type WorkoutLog } from '../domain/workout';
import type { MilestoneRepository, PlanRepository, WorkoutRepository } from './ports';

const HISTORY_SHOWN = 20;
const MINUTE_MS = 60 * 1000;
const DAY_MIN = 24 * 60;
const MILESTONES_WAIT_MS = 1500;

/** One exercise of a workout being started: what was done last time, and the sets to fill in. */
export type DraftExercise = { exercise: PlannedExercise; last: LoggedSet[]; sets: DraftSet[] };
export type WorkoutSummary = { durationMin: number; suggestions: Suggestion[]; achieved: Milestone[] };

export function trainingUseCases(deps: { plans: PlanRepository; workouts: WorkoutRepository; milestones: MilestoneRepository; clock: Clock; timezone: string }) {
  const { plans, workouts, milestones, clock, timezone } = deps;

  return {
    observePlans: plans.observeAll,
    observeLatestWorkout: workouts.observeLatest,
    /** The milestones with their state: what a measure of the body is checked against. */
    listMilestones: milestones.list,
    observeWorkoutsBetween: workouts.observeBetween,
    /** The milestones still to reach first, then the achieved ones, each by label. */
    observeMilestones(onNext: (list: Milestone[]) => void, onError: (error: Error) => void) {
      const order = (a: Milestone, b: Milestone) => Number(!!a.achievedAt) - Number(!!b.achievedAt) || a.label.localeCompare(b.label, 'fr');
      return milestones.observeAll((list) => onNext([...list].sort(order)), onError);
    },

    /** The starter programme from today; on the existing document (same id) when there is one. */
    async startFromTemplate(existing?: Plan) {
      const plan = starterPlan(dayKey(clock.now(), timezone));
      return existing ? plans.update({ ...plan, id: existing.id }) : plans.create(plan);
    },
    async savePlan(plan: Plan) {
      const problem = validatePlan(plan);
      if (problem) throw new Error(problem);
      return plans.update(plan);
    },

    /** The exercises of a session with what was done last time and the sets to fill in (the load to aim for, the planned reps). */
    async startWorkout(session: PlannedSession): Promise<DraftExercise[]> {
      return Promise.all(
        session.exercises.map(async (exercise) => {
          // A failed read (index still building, say) must not keep the workout from starting: it is the first time.
          const latest = await workouts.latestWithExercise(exercise.exerciseId).catch((error) => {
            console.warn(`Could not read the last workout with ${exercise.exerciseId}`, error);
            return undefined;
          });
          const last = latest?.sets.filter((s) => s.exerciseId === exercise.exerciseId) ?? [];
          return { exercise, last, sets: prefillSets(exercise, last) };
        }),
      );
    },

    /**
     * Reads what a finished workout earns (the loads to aim for, the milestones it crosses) and hands back the writes to run.
     * Nothing is written here: offline a write only settles once the server has it, so the caller runs `save` and shows the summary meanwhile.
     */
    async finishWorkout(input: { plan: Plan; session: PlannedSession; done: LoggedSet[]; startedAt: Date }) {
      const now = clock.now();
      const log: NewWorkoutLog = {
        day: dayKey(now, timezone),
        planId: input.plan.id,
        sessionName: input.session.name,
        exerciseIds: [...new Set(input.done.map((s) => s.exerciseId))],
        sets: input.done,
        // A session left open for days is recorded as a day: the rules refuse more.
        durationMin: Math.min(DAY_MIN, Math.max(1, Math.round((now.getTime() - input.startedAt.getTime()) / MINUTE_MS))),
        createdAt: now,
      };
      const problem = validateWorkout(log);
      if (problem) throw new Error(problem);

      // shortcut: a milestone that cannot be read within a moment (offline, the read waits for the network) is missed if the next workout
      // does not reach it again; the summary and the save do not wait for it.
      const achieved = reachedBy(await withTimeout(milestones.list().catch(() => []), MILESTONES_WAIT_MS, []), input.done);
      const summary: WorkoutSummary = { durationMin: log.durationMin, suggestions: suggestionsFor(input.session.exercises, input.done), achieved };
      const save = () =>
        workouts.add(
          log,
          achieved.map((m) => m.id),
        );
      return { summary, save };
    },

    /** The latest workouts that hold the exercise, newest first. */
    exerciseHistory: (exerciseId: string): Promise<WorkoutLog[]> => workouts.history(exerciseId, HISTORY_SHOWN),

    async addMilestone(milestone: NewMilestone) {
      const problem = validateMilestone(milestone);
      if (problem) throw new Error(problem);
      return milestones.create(milestone);
    },
    removeMilestone: (id: string) => milestones.remove(id),
  };
}

export type TrainingUseCases = ReturnType<typeof trainingUseCases>;
