import type { SyncMeta } from '../domain/sync';

/** The `days/{date}` totals the Today screen shows; a missing field reads as 0 (the steps source and time as nothing). */
export type DayTotals = {
  waterMl: number;
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  /** The steps read from Health Connect by the phone that writes them, where they come from (`fitbit` or `phone`), and when. */
  steps: number;
  stepsSource?: string;
  stepsSyncedAt?: Date;
};

export interface DayTotalsRepository {
  /** Live totals of `day` (0 when nothing was logged) with their snapshot metadata. Returns the unsubscribe function. */
  observe(day: string, onNext: (totals: DayTotals, sync: SyncMeta) => void, onError: (error: Error) => void): () => void;
}
