import type { NewWaterEntry, WaterEntry, WaterRepository } from '../application/ports';

/** WaterRepository kept in memory, for tests. `entries` is what it stores. */
export function inMemoryWaterRepository(): WaterRepository & { entries: WaterEntry[] } {
  let nextId = 1;
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach((listener) => listener());

  const repo = {
    entries: [] as WaterEntry[],
    async add(entry: NewWaterEntry) {
      repo.entries = [...repo.entries, { ...entry, id: String(nextId++) }];
      notify();
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
