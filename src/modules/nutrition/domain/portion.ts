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
  const proteinPct = Math.round((kcal.protein / total) * 100);
  const carbsPct = Math.round((kcal.carbs / total) * 100);
  return { proteinPct, carbsPct, fatPct: 100 - proteinPct - carbsPct };
}
