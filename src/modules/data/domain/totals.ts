export type Totals = { waterMl: number; kcal: number; proteinG: number; carbsG: number; fatG: number };
const NO_TOTALS: Totals = { waterMl: 0, kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 };

/** The live entries the totals of a day are made of (soft-deleted ones are left out by whoever reads them). */
export type TotalsInput = {
  water: { day: string; ml: number }[];
  food: { day: string; kcal: number; protein: number; carbs: number; fat: number }[];
  /** The days that have a totals document, with what it says now. */
  days: Map<string, Partial<Totals>>;
};

// Sums of 0.1-rounded floats drift; two decimals are enough for a macro.
const round = (n: number) => Math.round(n * 100) / 100;

/** The totals every day should have, from its entries; a day with a document and no entry is at zero. */
export function totalsFromEntries(input: TotalsInput): Map<string, Totals> {
  const totals = new Map<string, Totals>();
  const of = (day: string) => totals.get(day) ?? { ...NO_TOTALS };
  for (const day of input.days.keys()) totals.set(day, of(day));
  for (const w of input.water) totals.set(w.day, { ...of(w.day), waterMl: of(w.day).waterMl + w.ml });
  for (const f of input.food) {
    const t = of(f.day);
    totals.set(f.day, { ...t, kcal: t.kcal + f.kcal, proteinG: t.proteinG + f.protein, carbsG: t.carbsG + f.carbs, fatG: t.fatG + f.fat });
  }
  for (const [day, t] of totals) totals.set(day, { waterMl: round(t.waterMl), kcal: round(t.kcal), proteinG: round(t.proteinG), carbsG: round(t.carbsG), fatG: round(t.fatG) });
  return totals;
}

/** The days whose stored totals differ from the right ones by more than the drift the rules allow (0.05). */
export function daysToCorrect(right: Map<string, Totals>, stored: Map<string, Partial<Totals>>): Map<string, Totals> {
  const wrong = new Map<string, Totals>();
  for (const [day, t] of right) {
    const now = stored.get(day) ?? {};
    const differs = (Object.keys(t) as (keyof Totals)[]).some((key) => Math.abs((now[key] ?? 0) - t[key]) > 0.05);
    if (differs) wrong.set(day, t);
  }
  return wrong;
}
