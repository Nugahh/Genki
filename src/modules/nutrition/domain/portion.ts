import type { Macros } from './macros';
import type { Nutrients } from './nutrients';

const round1 = (n: number) => Math.round(n * 10) / 10;

/** The carbohydrates minus the fibre, never below zero; without the fibre they are the carbohydrates and the figure is only partial. */
export function netCarbs(macros: Macros, nutrients?: Nutrients): { grams: number; partial: boolean } {
  const fiber = nutrients?.fiber;
  return fiber === undefined ? { grams: macros.carbs, partial: true } : { grams: Math.max(0, round1(macros.carbs - fiber)), partial: false };
}

/** The share of the energy that comes from the protein, the net carbs and the fat (4, 4 and 9 kcal a gram), as whole percents that add up to 100. */
export function energySplit(protein: number, carbs: number, fat: number) {
  const kcal = { protein: protein * 4, carbs: carbs * 4, fat: fat * 9 };
  const total = kcal.protein + kcal.carbs + kcal.fat;
  if (total === 0) return undefined;
  // Largest remainder: whole percents that add up to 100 and are never negative.
  const raw = [kcal.protein, kcal.carbs, kcal.fat].map((k) => (k / total) * 100);
  const pct = raw.map(Math.floor);
  const byRemainder = raw.map((r, i) => i).sort((a, b) => raw[b] - pct[b] - (raw[a] - pct[a]));
  for (let left = 100 - pct.reduce((sum, n) => sum + n, 0), i = 0; left > 0; left--, i++) pct[byRemainder[i]]++;
  return { proteinPct: pct[0], carbsPct: pct[1], fatPct: pct[2] };
}
