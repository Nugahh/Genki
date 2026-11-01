import type { EntryChange, FavoriteMeal, Food, FoodEntry, FoodInput, NewFavoriteMeal, NewFoodEntry } from '../domain/food';

type Observe<T> = (onNext: (value: T) => void, onError: (error: Error) => void) => () => void;

/** The embedded Ciqual table: read-only, instant, offline. */
export interface FoodCatalog {
  search(query: string, options?: { state?: 'raw' | 'cooked'; limit?: number }): Promise<Food[]>;
  get(id: string): Promise<Food | undefined>;
}

/** The user's own foods. Writes settle once the server has them; observers see them at once. */
export interface FoodRepository {
  create(food: FoodInput): Promise<void>;
  update(id: string, food: FoodInput): Promise<void>;
  /** Soft delete. */
  remove(id: string): Promise<void>;
  observeAll: Observe<Food[]>;
}

export interface FoodEntryRepository {
  /** Also adds the entry's macros to the day totals. */
  add(entry: NewFoodEntry): Promise<void>;
  /**
   * Changes the quantity, group and time of the entry. Also moves the day totals in the same write: by the difference of the macros on the same day,
   * else the old macros come off the old day and the new ones go onto the new day.
   */
  update(entry: FoodEntry, change: EntryChange): Promise<void>;
  /** Soft delete; also takes the entry's macros off the day totals. */
  remove(entry: FoodEntry): Promise<void>;
  /** Live entries of `day`, deleted ones excluded. */
  observeDay(day: string, onNext: (entries: FoodEntry[]) => void, onError: (error: Error) => void): () => void;
  /** Live entries of the days `from` to `to` (inclusive), deleted ones excluded. */
  observeRange(from: string, to: string, onNext: (entries: FoodEntry[]) => void, onError: (error: Error) => void): () => void;
  /**
   * The live entries among the latest `limit` entries, newest first (so possibly fewer than `limit`):
   * deleted ones are filtered after the limit; a server-side filter would need a composite index.
   */
  observeRecent(limit: number, onNext: (entries: FoodEntry[]) => void, onError: (error: Error) => void): () => void;
}

export interface FavoriteMealRepository {
  create(meal: NewFavoriteMeal): Promise<void>;
  remove(id: string): Promise<void>;
  observeAll: Observe<FavoriteMeal[]>;
}
