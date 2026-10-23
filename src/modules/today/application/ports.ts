import type { SyncMeta } from '../domain/sync';

/** The `days/{date}` totals this milestone shows. */
export type DayTotals = { waterMl: number };

export interface DayTotalsRepository {
  /** Live totals of `day` (0 when nothing was logged) with their snapshot metadata. Returns the unsubscribe function. */
  observe(day: string, onNext: (totals: DayTotals, sync: SyncMeta) => void, onError: (error: Error) => void): () => void;
}
