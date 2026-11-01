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

describe('adopt: a product of Open Food Facts becomes a food of one\'s own', () => {
  const coca: FoodInput = {
    name: 'Coca-Cola', state: 'other', per100g: { kcal: 42.4, protein: 0, carbs: 10.6, fat: 0 }, portions: [{ label: 'Portion 330 ml ≈ 330 g', grams: 330 }],
    nutrients: { sugars: 10.6 }, source: 'off', brand: 'Coca-Cola Services', barcode: '5449000000996',
  };

  test('is written and listed, its reference known at once', async () => {
    const { foods } = setup();
    const { food, write } = foods.adopt(coca, []);
    await write();
    let custom: Food[] = [];
    foods.observeCustom((list) => (custom = list), () => {});
    expect(food.ref).toEqual({ type: 'custom', id: expect.any(String) });
    expect(custom).toEqual([food]);
    expect(custom[0]).toMatchObject({ source: 'off', brand: 'Coca-Cola Services', barcode: '5449000000996', nutrients: { sugars: 10.6 } });
  });

  test('writing it again, as a retry does, is still one food', async () => {
    const { foods } = setup();
    const adoption = foods.adopt(coca, []);
    await adoption.write();
    await adoption.write();
    let custom: Food[] = [];
    foods.observeCustom((list) => (custom = list), () => {});
    expect(custom).toHaveLength(1);
  });

  test('is not written twice for the same barcode: the food already there is used', async () => {
    const { foods } = setup();
    const first = foods.adopt(coca, []);
    await first.write();
    let custom: Food[] = [];
    foods.observeCustom((list) => (custom = list), () => {});
    const again = foods.adopt({ ...coca, name: 'Coca-Cola (autre fiche)' }, custom);
    expect(again.food).toBe(custom[0]);
    expect(custom).toHaveLength(1);
  });

  test('refuses what the rules would refuse, before any write', async () => {
    const { foods } = setup();
    expect(() => foods.adopt({ ...coca, name: ' ' }, [])).toThrow(/nom/i);
    let custom: Food[] = [];
    foods.observeCustom((list) => (custom = list), () => {});
    expect(custom).toEqual([]);
  });

  test('findByBarcode looks among the foods of the user', () => {
    const { foods } = setup();
    const mine: Food = { ref: { type: 'custom', id: '1' }, ...coca };
    expect(foods.findByBarcode('5449000000996', [mine])).toBe(mine);
    expect(foods.findByBarcode('1', [mine])).toBeUndefined();
  });
});
