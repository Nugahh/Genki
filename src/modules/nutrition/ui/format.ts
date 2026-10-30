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
