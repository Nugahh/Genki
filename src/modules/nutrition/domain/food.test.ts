import { isValidGrams, matchCustom, validateFood, type Food, type FoodInput } from './food';

const input = (over: Partial<FoodInput> = {}): FoodInput => ({
  name: 'Pain de mie complet',
  state: 'other',
  per100g: { kcal: 250, protein: 9, carbs: 45, fat: 4 },
  portions: [{ label: '1 tranche', grams: 30 }],
  ...over,
});

test('a quantity is valid from just above 0 up to 5 000 g, and never NaN or infinite', () => {
  for (const grams of [0.1, 5000]) expect(isValidGrams(grams)).toBe(true);
  for (const grams of [0, -1, 5001, Number.NaN, Number.POSITIVE_INFINITY]) expect(isValidGrams(grams)).toBe(false);
});

describe('validateFood', () => {
  test('accepts a sound food', () => expect(validateFood(input())).toBeNull());

  test.each<[string, Partial<FoodInput>]>([
    ['900 kcal per 100 g', { per100g: { kcal: 900, protein: 0, carbs: 0, fat: 0 } }],
    ['a name of 100 characters', { name: 'x'.repeat(100) }],
    ['20 portions', { portions: Array.from({ length: 20 }, (_, i) => ({ label: `p${i}`, grams: 10 })) }],
    ['a portion of 5 000 g', { portions: [{ label: 'énorme', grams: 5000 }] }],
    ['protein, carbs and fat adding up to 100.5 g', { per100g: { kcal: 400, protein: 40.5, carbs: 40, fat: 20 } }],
  ])('accepts %s', (_, over) => {
    expect(validateFood(input(over))).toBeNull();
  });

  test.each<[string, Partial<FoodInput>]>([
    ['an empty name', { name: '   ' }],
    ['a name over 100 characters', { name: 'x'.repeat(101) }],
    ['a negative value', { per100g: { kcal: 100, protein: -1, carbs: 0, fat: 0 } }],
    ['a NaN value', { per100g: { kcal: Number.NaN, protein: 0, carbs: 0, fat: 0 } }],
    ['more than 900 kcal per 100 g', { per100g: { kcal: 901, protein: 0, carbs: 0, fat: 0 } }],
    ['macros above 100 g per 100 g', { per100g: { kcal: 400, protein: 60, carbs: 60, fat: 0 } }],
    ['protein, carbs and fat adding up to 100.6 g', { per100g: { kcal: 400, protein: 40.6, carbs: 40, fat: 20 } }],
    ['21 portions', { portions: Array.from({ length: 21 }, (_, i) => ({ label: `p${i}`, grams: 10 })) }],
    ['a portion without a name', { portions: [{ label: ' ', grams: 10 }] }],
    ['a portion of 0 g', { portions: [{ label: 'rien', grams: 0 }] }],
    ['a portion over 5 000 g', { portions: [{ label: 'énorme', grams: 5001 }] }],
  ])('rejects %s', (_, over) => {
    expect(validateFood(input(over))).toEqual(expect.any(String));
  });
});

describe('matchCustom', () => {
  const food = (id: string, name: string, state: Food['state'] = 'other'): Food => ({
    ref: { type: 'custom', id }, name, state, per100g: { kcal: 1, protein: 0, carbs: 0, fat: 0 }, portions: [],
  });
  const foods = [food('1', 'Œuf dur maison'), food('2', 'Riz basmati cuit', 'cooked'), food('3', 'Riz basmati cru', 'raw')];

  test('ignores accents, case and ligatures, and needs every term', () => {
    expect(matchCustom(foods, 'oeuf').map((f) => f.ref.id)).toEqual(['1']);
    expect(matchCustom(foods, 'RIZ cuit').map((f) => f.ref.id)).toEqual(['2']);
  });

  test('filters by state and returns nothing for a blank query', () => {
    expect(matchCustom(foods, 'riz', 'raw').map((f) => f.ref.id)).toEqual(['3']);
    expect(matchCustom(foods, '  ')).toEqual([]);
  });
});
