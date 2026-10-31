import type { WorkoutRepository } from '../application/ports';
import type { NewWorkoutLog, WorkoutLog } from '../domain/workout';

const newestDayFirst = (a: WorkoutLog, b: WorkoutLog) => b.day.localeCompare(a.day) || b.createdAt.getTime() - a.createdAt.getTime();

/** WorkoutRepository kept in memory, for tests. */
export function inMemoryWorkoutRepository(): WorkoutRepository & { logs: WorkoutLog[] } {
  let nextId = 1;
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach((listener) => listener());
  const holding = (logs: WorkoutLog[], exerciseId: string) => logs.filter((l) => l.exerciseIds.includes(exerciseId)).sort(newestDayFirst);

  const repo = {
    logs: [] as WorkoutLog[],
    async add(log: NewWorkoutLog) {
      repo.logs = [...repo.logs, { ...log, id: String(nextId++) }];
      notify();
    },
    async latestWithExercise(exerciseId: string) {
      return holding(repo.logs, exerciseId)[0];
    },
    async history(exerciseId: string, max: number) {
      return holding(repo.logs, exerciseId).slice(0, max);
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
