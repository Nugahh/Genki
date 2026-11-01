type Unit = 'g' | 'mg' | 'µg';
export type NutrientGroup = 'vitamins' | 'minerals' | 'fiber' | 'limit';

// In display order. `limit` is what to keep under a ceiling; every other group is what to reach.
const LIST = [
  { id: 'vitA', label: 'Vitamine A', unit: 'µg', group: 'vitamins' },
  { id: 'vitD', label: 'Vitamine D', unit: 'µg', group: 'vitamins' },
  { id: 'vitE', label: 'Vitamine E', unit: 'mg', group: 'vitamins' },
  { id: 'vitK', label: 'Vitamine K', unit: 'µg', group: 'vitamins' },
  { id: 'vitC', label: 'Vitamine C', unit: 'mg', group: 'vitamins' },
  { id: 'vitB1', label: 'Vitamine B1', unit: 'mg', group: 'vitamins' },
  { id: 'vitB2', label: 'Vitamine B2', unit: 'mg', group: 'vitamins' },
  { id: 'vitB3', label: 'Vitamine B3', unit: 'mg', group: 'vitamins' },
  { id: 'vitB5', label: 'Vitamine B5', unit: 'mg', group: 'vitamins' },
  { id: 'vitB6', label: 'Vitamine B6', unit: 'mg', group: 'vitamins' },
  { id: 'vitB9', label: 'Vitamine B9', unit: 'µg', group: 'vitamins' },
  { id: 'vitB12', label: 'Vitamine B12', unit: 'µg', group: 'vitamins' },
  { id: 'calcium', label: 'Calcium', unit: 'mg', group: 'minerals' },
  { id: 'iron', label: 'Fer', unit: 'mg', group: 'minerals' },
  { id: 'magnesium', label: 'Magnésium', unit: 'mg', group: 'minerals' },
  { id: 'potassium', label: 'Potassium', unit: 'mg', group: 'minerals' },
  { id: 'zinc', label: 'Zinc', unit: 'mg', group: 'minerals' },
  { id: 'selenium', label: 'Sélénium', unit: 'µg', group: 'minerals' },
  { id: 'iodine', label: 'Iode', unit: 'µg', group: 'minerals' },
  { id: 'phosphorus', label: 'Phosphore', unit: 'mg', group: 'minerals' },
  { id: 'copper', label: 'Cuivre', unit: 'mg', group: 'minerals' },
  { id: 'manganese', label: 'Manganèse', unit: 'mg', group: 'minerals' },
  { id: 'fiber', label: 'Fibres', unit: 'g', group: 'fiber' },
  { id: 'salt', label: 'Sel', unit: 'g', group: 'limit' },
  { id: 'saturatedFat', label: 'Graisses saturées', unit: 'g', group: 'limit' },
  { id: 'sugars', label: 'Sucres', unit: 'g', group: 'limit' },
] as const;

export type NutrientId = (typeof LIST)[number]['id'];
export type NutrientInfo = { id: NutrientId; label: string; unit: Unit; group: NutrientGroup };
export const NUTRIENTS: readonly NutrientInfo[] = LIST;

/** Amounts by nutrient; a nutrient that is not there is not known (never zero by default). */
export type Nutrients = Partial<Record<NutrientId, number>>;

const entries = (n: Nutrients) => Object.entries(n) as [NutrientId, number][];
// Micrograms of a vitamin do not survive a rounding to 0.1: keep three significant digits.
const sig3 = (n: number) => Number(n.toPrecision(3));
const map = (n: Nutrients, f: (value: number) => number): Nutrients => Object.fromEntries(entries(n).map(([id, v]) => [id, sig3(f(v))]));

/** The nutrients of `grams` of a food given per 100 g: frozen into the entry. */
export const nutrientsFor = (per100g: Nutrients, grams: number): Nutrients => map(per100g, (v) => (v * grams) / 100);

/** The same entry at another quantity, from its own frozen values. Needs `from > 0`. */
export const scaleNutrients = (n: Nutrients, from: number, to: number): Nutrients => map(n, (v) => (v * to) / from);

/** The sum over entries, and the nutrients that at least one entry lacks (so the sum is a minimum). */
export function sumNutrients(list: (Nutrients | undefined)[]): { totals: Nutrients; incomplete: NutrientId[] } {
  const totals: Nutrients = {};
  for (const n of list) for (const [id, v] of entries(n ?? {})) totals[id] = (totals[id] ?? 0) + v;
  // Six digits wipe the float noise of the sum and keep everything an entry holds.
  for (const [id, v] of entries(totals)) totals[id] = Number(v.toPrecision(6));
  return { totals, incomplete: NUTRIENTS.map((n) => n.id).filter((id) => list.some((n) => n?.[id] === undefined)) };
}
