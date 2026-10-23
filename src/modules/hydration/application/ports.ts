export type WaterEntry = { id: string; day: string; ml: number; createdAt: Date };

export type NewWaterEntry = Omit<WaterEntry, 'id'>;

export interface WaterRepository {
  /** Also adds the glass to the day total. Settles once the server has the write: offline it stays pending while observers already see it. */
  add(entry: NewWaterEntry): Promise<void>;
  /** Soft delete: sets `deletedAt` and takes the glass off the day total. */
  remove(entry: WaterEntry): Promise<void>;
  /** Live entries of `day`, deleted ones excluded. Returns the unsubscribe function. */
  observeDay(day: string, onNext: (entries: WaterEntry[]) => void, onError: (error: Error) => void): () => void;
}
