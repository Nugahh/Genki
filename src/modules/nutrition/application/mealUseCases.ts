import { dayKey, type Clock } from '@/shared/clock';
import { isValidGrams, type FavoriteMeal, type Food, type FoodEntry, type FoodRef, type RecentFood } from '../domain/food';
import { macrosFor, scaleMacros } from '../domain/macros';
import { nutrientsFor, scaleNutrients } from '../domain/nutrients';
import type { Meal } from '../domain/meal';
import type { FavoriteMealRepository, FoodEntryRepository } from './ports';

const RECENT_WINDOW = 50;
const RECENT_SHOWN = 20;
const oldestFirst = (a: FoodEntry, b: FoodEntry) => a.createdAt.getTime() - b.createdAt.getTime();
const byName = (a: FavoriteMeal, b: FavoriteMeal) => a.name.localeCompare(b.name, 'fr');
// A use case does not trust its caller (the UI and the Firestore rules bound these values too).
const assertGrams = (grams: number) => {
  if (!isValidGrams(grams)) throw new Error('La quantité doit être comprise entre 0 et 5 000 g.');
};

export function mealUseCases(deps: { entries: FoodEntryRepository; favorites: FavoriteMealRepository; clock: Clock; timezone: string }) {
  const { entries, favorites, clock, timezone } = deps;

  // Writes are never awaited one after the other: offline, a write only settles once the server has it.
  // `offsetMs` keeps the entries of one favorite in order: same day, creation times 1 ms apart.
  const log = (meal: Meal, food: Pick<Food, 'ref' | 'name' | 'per100g' | 'nutrients'>, grams: number, now: Date, offsetMs = 0) =>
    entries.add({
      day: dayKey(now, timezone), meal, foodRef: food.ref, foodName: food.name, grams, macros: macrosFor(food.per100g, grams),
      ...(food.nutrients && { nutrients: nutrientsFor(food.nutrients, grams) }),
      createdAt: new Date(now.getTime() + offsetMs),
    });

  return {
    async logFood(meal: Meal, food: Pick<Food, 'ref' | 'name' | 'per100g' | 'nutrients'>, grams: number) {
      assertGrams(grams);
      return log(meal, food, grams, clock.now());
    },
    async changeGrams(entry: FoodEntry, grams: number) {
      assertGrams(grams);
      return entries.updateGrams(entry, grams, scaleMacros(entry.macros, entry.grams, grams), entry.nutrients && scaleNutrients(entry.nutrients, entry.grams, grams));
    },
    async removeEntry(entry: FoodEntry) {
      return entries.remove(entry);
    },
    /** The day's entries, oldest first. */
    observeDay(day: string, onNext: (list: FoodEntry[]) => void, onError: (error: Error) => void) {
      return entries.observeDay(day, (list) => onNext([...list].sort(oldestFirst)), onError);
    },
    /** The entries of the days `from` to `to` (inclusive), live, in no particular order. */
    observeBetween(from: string, to: string, onNext: (list: FoodEntry[]) => void, onError: (error: Error) => void) {
      return entries.observeRange(from, to, onNext, onError);
    },
    /** The distinct foods of the latest entries (the port lists them newest first), each with its last quantity. */
    observeRecent(onNext: (recents: RecentFood[]) => void, onError: (error: Error) => void) {
      return entries.observeRecent(
        RECENT_WINDOW,
        (list) => {
          const seen = new Set<string>();
          const recents: RecentFood[] = [];
          for (const e of list) {
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
    /** The saved meals, by name. */
    observeFavorites(onNext: (list: FavoriteMeal[]) => void, onError: (error: Error) => void) {
      return favorites.observeAll((list) => onNext([...list].sort(byName)), onError);
    },
    async saveFavorite(name: string, list: FoodEntry[]) {
      if (name.trim() === '' || list.length < 1 || list.length > 50) throw new Error('Un favori a un nom et 1 à 50 aliments.');
      return favorites.create({ name: name.trim(), items: list.map(({ foodRef, foodName, grams }) => ({ foodRef, foodName, grams })) });
    },
    async removeFavorite(id: string) {
      return favorites.remove(id);
    },
    /** Logs every food of the favorite that still exists (looked up through `resolve`) into `meal`. */
    async logFavorite(favorite: FavoriteMeal, meal: Meal, resolve: (ref: FoodRef) => Promise<Food | undefined>) {
      const now = clock.now();
      const foods = await Promise.all(favorite.items.map((item) => resolve(item.foodRef)));
      const writes = favorite.items.flatMap((item, i) => (foods[i] ? [log(meal, foods[i], item.grams, now, i)] : []));
      await Promise.all(writes);
    },
  };
}

export type MealUseCases = ReturnType<typeof mealUseCases>;
