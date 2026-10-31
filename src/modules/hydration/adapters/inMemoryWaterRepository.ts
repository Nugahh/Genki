import type { NewWaterEntry, WaterEntry, WaterRepository } from '../application/ports';

/** WaterRepository kept in memory, for tests. `entries` is what it stores. */
export function inMemoryWaterRepository(): WaterRepository & { entries: WaterEntry[] } {
  let nextId = 1;
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach((listener) => listener());

  const repo = {
    entries: [] as WaterEntry[],
    add(entry: NewWaterEntry) {
      const id = String(nextId++);
      repo.entries = [...repo.entries, { ...entry, id }];
      notify();
      return { id, saved: Promise.resolve() };
    },
    async remove(entry: WaterEntry) {
      repo.entries = repo.entries.filter((e) => e.id !== entry.id);
      notify();
    },
    observeDay(day: string, onNext: (entries: WaterEntry[]) => void) {
      const listener = () => onNext(repo.entries.filter((e) => e.day === day));
      listeners.add(listener);
      listener();
      return () => {
        listeners.delete(listener);
      };
    },
  };
  return repo;
}
