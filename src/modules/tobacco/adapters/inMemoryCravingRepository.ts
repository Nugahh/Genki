import type { CravingRepository } from '../application/ports';
import type { Craving, NewCraving } from '../domain/tobacco';

/** CravingRepository kept in memory, for tests. */
export function inMemoryCravingRepository(): CravingRepository & { cravings: Craving[] } {
  let nextId = 1;
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach((listener) => listener());
  const repo = {
    cravings: [] as Craving[],
    add(craving: NewCraving) {
      const id = String(nextId++);
      repo.cravings = [...repo.cravings, { ...craving, id }];
      notify();
      return { id, saved: Promise.resolve() };
    },
    async remove(id: string) {
      repo.cravings = repo.cravings.filter((c) => c.id !== id);
      notify();
    },
    observeBetween(from: string, to: string, onNext: (cravings: Craving[]) => void) {
      const listener = () => onNext(repo.cravings.filter((c) => c.day >= from && c.day <= to));
      listeners.add(listener);
      listener();
      return () => {
        listeners.delete(listener);
      };
    },
  };
  return repo;
}
