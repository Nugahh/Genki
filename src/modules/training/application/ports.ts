import type { Milestone, NewMilestone } from '../domain/milestone';
import type { NewPlan, Plan } from '../domain/plan';
import type { NewWorkoutLog, WorkoutLog } from '../domain/workout';

export interface PlanRepository {
  /** Settles once the server has the write: offline it stays pending while observers already see the programme. */
  create(plan: NewPlan): Promise<void>;
  update(plan: Plan): Promise<void>;
  observeAll(onNext: (plans: Plan[]) => void, onError: (error: Error) => void): () => void;
}

export interface WorkoutRepository {
  /**
   * Records the workout and sets `achievedAt` (once: the rules refuse a second time) on the milestones it reached, in one batch:
   * either all of it is written or none, so a retry never leaves a log without its milestones or the other way round.
   */
  add(log: NewWorkoutLog, reachedMilestoneIds?: string[]): Promise<void>;
  /** The latest workout that holds the exercise (by day, newest first), or undefined. Reads from the cache offline. */
  latestWithExercise(exerciseId: string): Promise<WorkoutLog | undefined>;
  /** The workouts that hold the exercise, newest first. */
  history(exerciseId: string, max: number): Promise<WorkoutLog[]>;
  /** The latest workout, whatever its exercises. */
  observeLatest(onNext: (log: WorkoutLog | undefined) => void, onError: (error: Error) => void): () => void;
}

export interface MilestoneRepository {
  create(milestone: NewMilestone): Promise<void>;
  remove(id: string): Promise<void>;
  list(): Promise<Milestone[]>;
  observeAll(onNext: (milestones: Milestone[]) => void, onError: (error: Error) => void): () => void;
}
