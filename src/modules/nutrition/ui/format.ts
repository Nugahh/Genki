import type { Food, FoodInput, Portion } from '../domain/food';
import type { Macros } from '../domain/macros';
import type { Meal } from '../domain/meal';

export const MEAL_LABELS: Record<Meal, string> = {
  breakfast: 'Petit-déjeuner',
  lunch: 'Déjeuner',
  dinner: 'Dîner',
  snack: 'Collations',
};

/** Whole calories, with the French thousands separator. */
export const kcalText = (kcal: number) => kcal.toLocaleString('fr-FR', { maximumFractionDigits: 0 });

/** At most one decimal, with a comma: 0,6. */
export const gramsText = (g: number) => g.toLocaleString('fr-FR', { maximumFractionDigits: 1 });

export const macrosText = (m: Macros) =>
  `${kcalText(m.kcal)} kcal · ${gramsText(m.protein)} g de protéines · ${gramsText(m.carbs)} g de glucides · ${gramsText(m.fat)} g de lipides`;

/** A number typed with a comma or a point; NaN when empty or not a number. */
export const parseNumber = (text: string) => (text.trim() === '' ? NaN : Number(text.replace(',', '.')));

/** A number as it is typed in a field, with a comma: the way back from `parseNumber`. */
export const asText = (n: number) => String(n).replace('.', ',');

/** The package of a product, else its portion: the quantity it is sold in. */
const productPortion = (portions: Portion[]) => portions.find((p) => p.label.startsWith('Emballage ')) ?? portions.find((p) => p.label.startsWith('Portion '));

/** « 330 ml » for a product: the size of its package, else of its portion (« Emballage 330 ml ≈ 330 g » → « 330 ml »). */
export const productQuantity = (portions: Portion[]) => productPortion(portions)?.label.replace(/^(Emballage|Portion) /, '').replace(/ ≈ .*$/, '');

/** The grams of that quantity (« Emballage 330 ml ≈ 330 g » → 330): what a product is added at unless told otherwise. */
export const productGrams = (portions: Portion[]) => productPortion(portions)?.grams;

/** The one line under a name in a list: « 330 ml · Coca-Cola · 42 kcal / 100 g » for a product of a brand, « 350 kcal / 100 g » for the other foods. */
export const foodLine = (food: Food | FoodInput) =>
  food.source === 'off'
    ? [productQuantity(food.portions) ?? '100 g', food.brand, `${kcalText(food.per100g.kcal)} kcal / 100 g`].filter(Boolean).join(' · ')
    : `${kcalText(food.per100g.kcal)} kcal / 100 g`;
