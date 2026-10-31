import type { FactsSource } from '../application/ports';
import type { DayFacts } from '../domain/metric';

/** FactsSource kept in memory, for tests: `set` replaces the facts and tells the observers. `ranges` lists what was asked. */
export function inMemoryFactsSource(initial: Record<string, DayFacts> = {}): FactsSource & { set(facts: Record<string, DayFacts>): void; ranges: [string, string][]; observers: number } {
  let facts = initial;
  const listeners = new Set<() => void>();
  const source = {
    ranges: [] as [string, string][],
    get observers() {
      return listeners.size;
    },
    set(next: Record<string, DayFacts>) {
      facts = next;
      listeners.forEach((listener) => listener());
    },
    observeRange(from: string, to: string, onNext: (facts: Map<string, DayFacts>) => void) {
      source.ranges.push([from, to]);
      const listener = () => onNext(new Map(Object.entries(facts).filter(([day]) => day >= from && day <= to)));
      listeners.add(listener);
      listener();
      return () => {
        listeners.delete(listener);
      };
    },
  };
  return source;
}
