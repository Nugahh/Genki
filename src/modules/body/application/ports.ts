import type { Measure } from '../domain/body';

export interface BodyRepository {
  /** The measures of the days `from` to `to` (inclusive), live; a day with none is not in the map. Returns the unsubscribe function. */
  observeRecent(from: string, to: string, onNext: (days: Map<string, Measure>) => void, onError: (error: Error) => void): () => void;
  /**
   * Merges the measure into the day (the totals of the day are left alone) and sets `achievedAt` (once: the rules refuse a second time)
   * on the milestones it reached, in one batch: all of it is written or none.
   */
  save(day: string, measure: Measure, reachedMilestoneIds: string[], at: Date): Promise<void>;
}
