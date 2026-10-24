export type Macros = { kcal: number; protein: number; carbs: number; fat: number };

export const ZERO_MACROS: Macros = { kcal: 0, protein: 0, carbs: 0, fat: 0 };

const round1 = (n: number) => Math.round(n * 10) / 10;
const map = (m: Macros, f: (n: number) => number): Macros => ({ kcal: f(m.kcal), protein: f(m.protein), carbs: f(m.carbs), fat: f(m.fat) });

/** Macros of `grams` of a food given per 100 g, rounded to 0.1: frozen into the entry (spec §4 rule 5). */
export function macrosFor(per100g: Macros, grams: number): Macros {
  return map(per100g, (n) => round1((n * grams) / 100));
}

/** The same entry at another quantity, from its own frozen values: never from the food's current ones. */
export function scaleMacros(macros: Macros, from: number, to: number): Macros {
  return map(macros, (n) => round1((n * to) / from));
}

export function sumMacros(list: Macros[]): Macros {
  return list.reduce((sum, m) => ({ kcal: round1(sum.kcal + m.kcal), protein: round1(sum.protein + m.protein), carbs: round1(sum.carbs + m.carbs), fat: round1(sum.fat + m.fat) }), ZERO_MACROS);
}

/** `a − b`, rounded: the delta a day total moves by when an entry changes. */
export function subtractMacros(a: Macros, b: Macros): Macros {
  return { kcal: round1(a.kcal - b.kcal), protein: round1(a.protein - b.protein), carbs: round1(a.carbs - b.carbs), fat: round1(a.fat - b.fat) };
}
