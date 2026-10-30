import type { FavoriteMeal, Food, FoodEntry, FoodInput, NewFavoriteMeal, NewFoodEntry } from '../domain/food';
import type { Macros } from '../domain/macros';

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
  /** Also moves the day totals by the difference between `macros` and the entry's current ones. */
  updateGrams(entry: FoodEntry, grams: number, macros: Macros): Promise<void>;
  /** Soft delete; also takes the entry's macros off the day totals. */
  remove(entry: FoodEntry): Promise<void>;
  /** Live entries of `day`, deleted ones excluded. */
  observeDay(day: string, onNext: (entries: FoodEntry[]) => void, onError: (error: Error) => void): () => void;
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
