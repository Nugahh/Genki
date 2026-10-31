import type { Craving, NewCraving } from '../domain/tobacco';

export interface CravingRepository {
  /** The craving is in at once: observers see it under `id`; `saved` settles once the server has the write (offline it stays pending). */
  add(craving: NewCraving): { id: string; saved: Promise<void> };
  /** Takes a craving back (a mis-tap): nothing else depends on it. */
  remove(id: string): Promise<void>;
  /** The cravings of the days `from` to `to` (inclusive), live. Returns the unsubscribe function. */
  observeBetween(from: string, to: string, onNext: (cravings: Craving[]) => void, onError: (error: Error) => void): () => void;
}
