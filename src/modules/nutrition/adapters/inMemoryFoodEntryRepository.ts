import type { FoodEntryRepository } from '../application/ports';
import type { FoodEntry, NewFoodEntry } from '../domain/food';
import type { Nutrients } from '../domain/nutrients';

/** FoodEntryRepository kept in memory, for tests. `entries` is what it stores. */
export function inMemoryFoodEntryRepository(): FoodEntryRepository & { entries: FoodEntry[] } {
  let nextId = 1;
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach((listener) => listener());
  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    listener();
    return () => {
      listeners.delete(listener);
    };
  };

  const repo = {
    entries: [] as FoodEntry[],
    async add(entry: NewFoodEntry) {
      repo.entries = [...repo.entries, { ...entry, id: String(nextId++) }];
      notify();
    },
    async updateGrams(entry: FoodEntry, grams: number, macros: FoodEntry['macros'], nutrients?: Nutrients) {
      repo.entries = repo.entries.map((e) => (e.id === entry.id ? { ...e, grams, macros, ...(nutrients && { nutrients }) } : e));
      notify();
    },
    async remove(entry: FoodEntry) {
      repo.entries = repo.entries.filter((e) => e.id !== entry.id);
      notify();
    },
    observeDay(day: string, onNext: (entries: FoodEntry[]) => void) {
      return subscribe(() => onNext(repo.entries.filter((e) => e.day === day)));
    },
    observeRange(from: string, to: string, onNext: (entries: FoodEntry[]) => void) {
      return subscribe(() => onNext(repo.entries.filter((e) => e.day >= from && e.day <= to)));
    },
    observeRecent(limit: number, onNext: (entries: FoodEntry[]) => void) {
      return subscribe(() => onNext([...repo.entries].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, limit)));
    },
  };
  return repo;
}
