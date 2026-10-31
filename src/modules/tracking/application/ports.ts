import type { DayFacts } from '../domain/metric';

/** Where the facts of the days come from; each source knows some fields of `DayFacts` (the others stay missing). */
export interface FactsSource {
  /** The facts of the days `from` to `to` (inclusive), live; a day with no record is not in the map. Returns the unsubscribe function. */
  observeRange(from: string, to: string, onNext: (facts: Map<string, DayFacts>) => void, onError: (error: Error) => void): () => void;
}
