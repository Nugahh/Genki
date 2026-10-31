import type { BodyRepository } from '../application/ports';
import type { Measure } from '../domain/body';

/** BodyRepository kept in memory, for tests. The milestones a measure reaches are marked on `milestones` first: a refused one leaves no measure. */
export function inMemoryBodyRepository(milestones?: { markAchieved(id: string, at: Date): Promise<void> }): BodyRepository & { days: Map<string, Measure> } {
  const listeners = new Set<() => void>();
  const repo = {
    days: new Map<string, Measure>(),
    observeRecent(from: string, to: string, onNext: (days: Map<string, Measure>) => void) {
      const listener = () => onNext(new Map([...repo.days].filter(([day]) => day >= from && day <= to)));
      listeners.add(listener);
      listener();
      return () => {
        listeners.delete(listener);
      };
    },
    async save(day: string, measure: Measure, reached: string[], at: Date) {
      if (reached.length > 0 && !milestones) throw new Error('No milestones to mark');
      for (const id of reached) await milestones?.markAchieved(id, at);
      repo.days = new Map(repo.days).set(day, { ...repo.days.get(day), ...measure });
      listeners.forEach((listener) => listener());
    },
  };
  return repo;
}
