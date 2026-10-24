import { dayKey, type Clock } from '@/shared/clock';
import type { FavoriteMeal, Food, FoodEntry, FoodRef, RecentFood } from '../domain/food';
import { macrosFor, scaleMacros } from '../domain/macros';
import type { Meal } from '../domain/meal';
import type { FavoriteMealRepository, FoodEntryRepository } from './ports';

const RECENT_WINDOW = 50;
const RECENT_SHOWN = 20;
const oldestFirst = (a: FoodEntry, b: FoodEntry) => a.createdAt.getTime() - b.createdAt.getTime();

export function mealUseCases(deps: { entries: FoodEntryRepository; favorites: FavoriteMealRepository; clock: Clock; timezone: string }) {
  const { entries, favorites, clock, timezone } = deps;

  // Writes are never awaited one after the other: offline, a write only settles once the server has it.
  const log = (meal: Meal, food: Pick<Food, 'ref' | 'name' | 'per100g'>, grams: number, now: Date) =>
    entries.add({ day: dayKey(now, timezone), meal, foodRef: food.ref, foodName: food.name, grams, macros: macrosFor(food.per100g, grams), createdAt: now });

  return {
    async logFood(meal: Meal, food: Pick<Food, 'ref' | 'name' | 'per100g'>, grams: number) {
      return log(meal, food, grams, clock.now());
    },
    async changeGrams(entry: FoodEntry, grams: number) {
      return entries.updateGrams(entry, grams, scaleMacros(entry.macros, entry.grams, grams));
    },
    async removeEntry(entry: FoodEntry) {
      return entries.remove(entry);
    },
    /** The day's entries, oldest first. */
    observeDay(day: string, onNext: (list: FoodEntry[]) => void, onError: (error: Error) => void) {
      return entries.observeDay(day, (list) => onNext([...list].sort(oldestFirst)), onError);
    },
    /** The distinct foods of the latest entries, newest first, each with its last quantity. */
    observeRecent(onNext: (recents: RecentFood[]) => void, onError: (error: Error) => void) {
      return entries.observeRecent(
        RECENT_WINDOW,
        (list) => {
          const seen = new Set<string>();
          const recents: RecentFood[] = [];
          for (const e of [...list].sort((a, b) => oldestFirst(b, a))) {
            const key = `${e.foodRef.type}:${e.foodRef.id}`;
            if (seen.has(key)) continue;
            seen.add(key);
            recents.push({ ref: e.foodRef, name: e.foodName, grams: e.grams });
          }
          onNext(recents.slice(0, RECENT_SHOWN));
        },
        onError,
      );
    },
    observeFavorites: favorites.observeAll,
    async saveFavorite(name: string, list: FoodEntry[]) {
      return favorites.create({ name: name.trim(), items: list.map(({ foodRef, foodName, grams }) => ({ foodRef, foodName, grams })) });
    },
    async removeFavorite(id: string) {
      return favorites.remove(id);
    },
    /** Logs every food of the favorite that still exists (looked up through `resolve`) into `meal`. */
    async logFavorite(favorite: FavoriteMeal, meal: Meal, resolve: (ref: FoodRef) => Promise<Food | undefined>) {
      const now = clock.now();
      const foods = await Promise.all(favorite.items.map((item) => resolve(item.foodRef)));
      const writes = favorite.items.flatMap((item, i) => (foods[i] ? [log(meal, foods[i], item.grams, now)] : []));
      await Promise.all(writes);
    },
  };
}

export type MealUseCases = ReturnType<typeof mealUseCases>;
