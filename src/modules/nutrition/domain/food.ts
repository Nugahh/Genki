import type { Macros } from './macros';
import type { Meal } from './meal';
import { normalizeSearch } from './normalize';

export type FoodState = 'raw' | 'cooked' | 'other';
export type FoodRef = { type: 'ciqual' | 'custom'; id: string };
export type Portion = { label: string; grams: number };
export type Food = { ref: FoodRef; name: string; state: FoodState; per100g: Macros; portions: Portion[] };
/** What the user types to create or edit a custom food. */
export type FoodInput = Omit<Food, 'ref'>;

export type FoodEntry = {
  id: string;
  day: string;
  meal: Meal;
  foodRef: FoodRef;
  foodName: string;
  grams: number;
  /** Frozen when the entry was logged (spec §4 rule 5). */
  macros: Macros;
  createdAt: Date;
};
export type NewFoodEntry = Omit<FoodEntry, 'id'>;

export type FavoriteItem = { foodRef: FoodRef; foodName: string; grams: number };
/** A "repas type": a few foods with quantities, logged back in one tap. */
export type FavoriteMeal = { id: string; name: string; items: FavoriteItem[] };
export type NewFavoriteMeal = Omit<FavoriteMeal, 'id'>;

export type RecentFood = { ref: FoodRef; name: string; grams: number };

/** A French message for the first problem with a custom food, or null. The Firestore rules bound each value; the sum of the macros (100.5 g at most) and the portion weights are checked here only. */
export function validateFood(food: FoodInput): string | null {
  const name = food.name.trim();
  if (name.length === 0 || name.length > 100) return 'Le nom doit faire entre 1 et 100 caractères.';
  const values = Object.values(food.per100g);
  if (!values.every(Number.isFinite) || values.some((n) => n < 0)) return 'Les valeurs nutritionnelles doivent être des nombres positifs.';
  const { kcal, protein, carbs, fat } = food.per100g;
  if (kcal > 900) return 'Plus de 900 kcal pour 100 g n’est pas possible.';
  if (protein > 100 || carbs > 100 || fat > 100 || protein + carbs + fat > 100.5) return 'Protéines, glucides et lipides dépassent 100 g pour 100 g.';
  if (food.portions.length > 20) return '20 portions au maximum.';
  if (food.portions.some((p) => p.label.trim().length === 0 || !(p.grams > 0 && p.grams <= 5000))) {
    return 'Chaque portion a un nom et un poids entre 0 et 5 000 g.';
  }
  return null;
}

/** The custom foods matching every term of `query` (accents and case ignored), by name. */
export function matchCustom(foods: Food[], query: string, state?: 'raw' | 'cooked'): Food[] {
  const terms = normalizeSearch(query).split(' ').filter(Boolean);
  if (terms.length === 0) return [];
  return foods
    .filter((f) => (!state || f.state === state) && terms.every((t) => normalizeSearch(f.name).includes(t)))
    .sort((a, b) => a.name.localeCompare(b.name, 'fr'));
}
