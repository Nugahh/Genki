import { inMemoryFoodCatalog } from '../adapters/inMemoryFoodCatalog';
import { inMemoryFoodRepository } from '../adapters/inMemoryFoodRepository';
import type { Food, FoodInput } from '../domain/food';
import { foodUseCases } from './foodUseCases';

const ciqualRice: Food = {
  ref: { type: 'ciqual', id: '9100' }, name: 'Riz blanc, cru', state: 'raw',
  per100g: { kcal: 354, protein: 7, carbs: 78, fat: 0.6 }, portions: [],
};
const input: FoodInput = {
  name: '  Pain maison ', state: 'other', per100g: { kcal: 250, protein: 8, carbs: 48, fat: 2 }, portions: [{ label: ' 1 tranche ', grams: 30 }],
};

const setup = () => ({ foods: foodUseCases({ catalog: inMemoryFoodCatalog([ciqualRice]), repo: inMemoryFoodRepository() }) });

test('searches the catalog, with an optional state', async () => {
  const { foods } = setup();
  expect(await foods.searchCatalog('riz')).toEqual([ciqualRice]);
  expect(await foods.searchCatalog('riz', 'cooked')).toEqual([]);
});

test('create trims and validates; an invalid food is rejected before any write', async () => {
  const { foods } = setup();
  await foods.create(input);
  let custom: Food[] = [];
  foods.observeCustom((list) => (custom = list), () => {});
  expect(custom.map((f) => f.name)).toEqual(['Pain maison']);
  expect(custom[0].portions).toEqual([{ label: '1 tranche', grams: 30 }]);
  await expect(foods.create({ ...input, name: ' ' })).rejects.toThrow(/nom/i);
  expect(custom).toHaveLength(1);
});

test('update and remove change the custom list', async () => {
  const { foods } = setup();
  await foods.create(input);
  let custom: Food[] = [];
  foods.observeCustom((list) => (custom = list), () => {});
  await foods.update(custom[0].ref.id, { ...input, name: 'Pain de mie' });
  expect(custom[0].name).toBe('Pain de mie');
  await foods.remove(custom[0].ref.id);
  expect(custom).toEqual([]);
});

test('resolve finds a Ciqual food in the catalog and a custom one in the list the caller holds', async () => {
  const { foods } = setup();
  const custom: Food = { ...ciqualRice, ref: { type: 'custom', id: 'c1' }, name: 'Perso' };
  expect(await foods.resolve({ type: 'ciqual', id: '9100' }, [])).toEqual(ciqualRice);
  expect(await foods.resolve({ type: 'custom', id: 'c1' }, [custom])).toEqual(custom);
  expect(await foods.resolve({ type: 'custom', id: 'gone' }, [custom])).toBeUndefined();
});
