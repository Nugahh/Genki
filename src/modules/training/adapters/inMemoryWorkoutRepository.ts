import type { WorkoutRepository } from '../application/ports';
import type { NewWorkoutLog, WorkoutLog } from '../domain/workout';

const newestDayFirst = (a: WorkoutLog, b: WorkoutLog) => b.day.localeCompare(a.day) || b.createdAt.getTime() - a.createdAt.getTime();

/** WorkoutRepository kept in memory, for tests. The milestones a workout reaches are marked on `milestones`, before the log is kept: a refused milestone leaves no log. */
export function inMemoryWorkoutRepository(milestones?: { markAchieved(id: string, at: Date): Promise<void> }): WorkoutRepository & { logs: WorkoutLog[] } {
  let nextId = 1;
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach((listener) => listener());
  const holding = (logs: WorkoutLog[], exerciseId: string) => logs.filter((l) => l.exerciseIds.includes(exerciseId)).sort(newestDayFirst);

  const repo = {
    logs: [] as WorkoutLog[],
    async add(log: NewWorkoutLog, reachedMilestoneIds: string[] = []) {
      if (reachedMilestoneIds.length > 0 && !milestones) throw new Error('No milestones to mark');
      for (const id of reachedMilestoneIds) await milestones?.markAchieved(id, log.createdAt);
      repo.logs = [...repo.logs, { ...log, id: String(nextId++) }];
      notify();
    },
    async latestWithExercise(exerciseId: string) {
      return holding(repo.logs, exerciseId)[0];
    },
    async history(exerciseId: string, max: number) {
      return holding(repo.logs, exerciseId).slice(0, max);
    },
    observeBetween(from: string, to: string, onNext: (logs: WorkoutLog[]) => void) {
      const listener = () => onNext(repo.logs.filter((l) => l.day >= from && l.day <= to));
      listeners.add(listener);
      listener();
      return () => {
        listeners.delete(listener);
      };
    },
    observeLatest(onNext: (log: WorkoutLog | undefined) => void) {
      const listener = () => onNext([...repo.logs].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0]);
      listeners.add(listener);
      listener();
      return () => {
        listeners.delete(listener);
      };
    },
  };
  return repo;
}
