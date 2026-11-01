import { validateFood, type FoodInput, type Portion } from './food';
import type { NutrientId, Nutrients } from './nutrients';

/** The fields of a product that Open Food Facts is asked for (api/v2/product, cgi/search.pl). A value can be a string: nothing is trusted. */
export type OffProduct = {
  code?: string;
  product_name?: string;
  product_name_fr?: string;
  brands?: string;
  quantity?: string;
  product_quantity?: number | string;
  serving_size?: string;
  serving_quantity?: number | string;
  nutriments?: Record<string, number | string | undefined>;
};

/** A weight in grams from a text like « 330 ml », « 1,5 L », « 250 g »; a volume counts as water (1 ml = 1 g) and says so. A pack (« 6 x 33 cl ») has no single weight. */
export function parseQuantity(text: string): { grams: number; approx: boolean; amount: string } | undefined {
  if (/\d\s*[x×]\s*\d/i.test(text)) return undefined;
  const match = /(\d+(?:[.,]\d+)?)\s*(kg|g|ml|cl|l)(?![a-z])/i.exec(text);
  if (!match) return undefined;
  const value = Number(match[1].replace(',', '.'));
  const unit = match[2].toLowerCase();
  const per = { kg: 1000, g: 1, l: 1000, cl: 10, ml: 1 }[unit as 'kg'];
  return { grams: Math.round(value * per * 10) / 10, approx: unit !== 'g' && unit !== 'kg', amount: `${match[1]} ${match[2]}` };
}

// Open Food Facts gives the vitamins and minerals in grams per 100 g: [nutrient, factor to the unit of the catalogue].
const MG = 1000;
const UG = 1000000;
const NUTRIENT_KEYS: Record<string, [NutrientId, number]> = {
  fiber_100g: ['fiber', 1], sugars_100g: ['sugars', 1], 'saturated-fat_100g': ['saturatedFat', 1], salt_100g: ['salt', 1],
  'vitamin-a_100g': ['vitA', UG], 'vitamin-d_100g': ['vitD', UG], 'vitamin-e_100g': ['vitE', MG], 'vitamin-k_100g': ['vitK', UG], 'vitamin-c_100g': ['vitC', MG],
  'vitamin-b1_100g': ['vitB1', MG], 'vitamin-b2_100g': ['vitB2', MG], 'vitamin-pp_100g': ['vitB3', MG], 'pantothenic-acid_100g': ['vitB5', MG],
  'vitamin-b6_100g': ['vitB6', MG], 'vitamin-b9_100g': ['vitB9', UG], 'vitamin-b12_100g': ['vitB12', UG],
  calcium_100g: ['calcium', MG], iron_100g: ['iron', MG], magnesium_100g: ['magnesium', MG], potassium_100g: ['potassium', MG], zinc_100g: ['zinc', MG],
  selenium_100g: ['selenium', UG], iodine_100g: ['iodine', UG], phosphorus_100g: ['phosphorus', MG], copper_100g: ['copper', MG], manganese_100g: ['manganese', MG],
};

/** A reading that is a finite number of zero or more; Open Food Facts sometimes sends text. */
const reading = (value: number | string | undefined) => {
  const n = typeof value === 'string' ? Number(value) : value;
  return typeof n === 'number' && Number.isFinite(n) && n >= 0 ? n : undefined;
};
const round1 = (n: number) => Math.round(n * 10) / 10;
const sig3 = (n: number) => Number(n.toPrecision(3));

function portionOf(kind: 'Portion' | 'Emballage', text: string | undefined): Portion | undefined {
  const quantity = text === undefined ? undefined : parseQuantity(text);
  if (!quantity) return undefined;
  return { label: `${kind} ${quantity.amount}${quantity.approx ? ` ≈ ${quantity.grams} g` : ''}`, grams: quantity.grams };
}

export type OffConversion = { ok: true; food: FoodInput } | { ok: false; reason: string };

/**
 * A product of Open Food Facts as a food of one's own. A product that does not give its calories and its protein, carbohydrates and fat is refused
 * (no line is better than a wrong one), and so is one whose values cannot be true.
 */
export function fromOpenFoodFacts(product: OffProduct): OffConversion {
  const n = product.nutriments ?? {};
  const kj = reading(n['energy-kj_100g']);
  const kcal = reading(n['energy-kcal_100g']) ?? (kj === undefined ? undefined : kj / 4.184);
  const [protein, carbs, fat] = [reading(n.proteins_100g), reading(n.carbohydrates_100g), reading(n.fat_100g)];
  if (kcal === undefined || protein === undefined || carbs === undefined || fat === undefined) {
    return { ok: false, reason: 'Open Food Facts ne donne pas les calories et les macros de ce produit.' };
  }

  const nutrients: Nutrients = {};
  for (const [key, [id, factor]] of Object.entries(NUTRIENT_KEYS)) {
    const value = reading(n[key]);
    // The rules bound a nutrient to 1 000 000: a reading above is a mistake of the contributor.
    if (value !== undefined && value * factor <= 1000000) nutrients[id] = sig3(value * factor);
  }

  const serving = portionOf('Portion', product.serving_size);
  const pack = portionOf('Emballage', product.quantity);
  const portions = [serving, pack && pack.grams !== serving?.grams ? pack : undefined].filter((p): p is Portion => p !== undefined);
  const brand = product.brands?.split(',')[0].trim();
  const barcode = product.code && /^\d{8,14}$/.test(product.code) ? product.code : undefined;

  const food: FoodInput = {
    name: product.product_name_fr?.trim() || product.product_name?.trim() || 'Produit sans nom',
    state: 'other',
    per100g: { kcal: round1(kcal), protein: round1(protein), carbs: round1(carbs), fat: round1(fat) },
    portions,
    ...(Object.keys(nutrients).length > 0 && { nutrients }),
    source: 'off',
    ...(brand && { brand }),
    ...(barcode && { barcode }),
  };
  return validateFood(food) ? { ok: false, reason: 'Les valeurs de ce produit ne sont pas plausibles.' } : { ok: true, food };
}
