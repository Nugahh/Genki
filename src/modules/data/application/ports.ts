import type { CollectionName, RawDoc, RestoreWrite } from '../domain/backup';
import type { Totals, TotalsInput } from '../domain/totals';

export type RestoreResult = { written: number; failed: number; firstError?: string };

export interface DataStore {
  /** The profile document and every collection of `users/{uid}`, in the JSON form of a backup. */
  readAll(): Promise<{ profile: Record<string, unknown>; collections: Partial<Record<CollectionName, RawDoc[]>> }>;
  /**
   * Merges the profile and writes the documents, in batches. A batch the rules refuse is counted as failed, with the first message,
   * and the others still go through. Settles once the server has them: it needs the network.
   */
  restore(profile: Record<string, unknown>, writes: RestoreWrite[]): Promise<RestoreResult>;
  /** The live water and food entries, and the totals documents with what they say. */
  readTotalsInput(): Promise<TotalsInput>;
  /** Sets the totals of the days given, leaving the other fields of the day (the weight) alone. */
  writeTotals(totals: Map<string, Totals>): Promise<void>;
}
