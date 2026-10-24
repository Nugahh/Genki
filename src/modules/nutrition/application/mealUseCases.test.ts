import { inMemoryFavoriteMealRepository } from '../adapters/inMemoryFavoriteMealRepository';
import { inMemoryFoodEntryRepository } from '../adapters/inMemoryFoodEntryRepository';
import type { Food, FoodEntry } from '../domain/food';
import { mealUseCases } from './mealUseCases';

const rice: Food = {
  ref: { type: 'ciqual', id: '9100' }, name: 'Riz blanc, cru', state: 'raw',
  per100g: { kcal: 350, protein: 7, carbs: 78, fat: 0.6 }, portions: [],
};
const egg: Food = {
  ref: { type: 'custom', id: 'e1' }, name: 'Oeuf', state: 'other',
  per100g: { kcal: 140, protein: 12, carbs: 1, fat: 10 }, portions: [{ label: '1 œuf', grams: 60 }],
};

function setup(now = '2026-10-24T09:00:00Z') {
  const clock = { now: () => new Date(now) };
  const entries = inMemoryFoodEntryRepository();
  const favorites = inMemoryFavoriteMealRepository();
  const meals = mealUseCases({ entries, favorites, clock, timezone: 'Europe/Paris' });
  return { clock, entries, favorites, meals };
}

const latest = (entries: { entries: FoodEntry[] }) => entries.entries[entries.entries.length - 1];

test('logFood freezes the macros of the quantity and uses the profile-zone day', async () => {
  const { entries, meals } = setup('2026-10-24T22:10:00Z'); // 00:10 in Paris, already the 25th
  await meals.logFood('snack', rice, 200);
  expect(latest(entries)).toMatchObject({
    day: '2026-10-25', meal: 'snack', foodRef: rice.ref, foodName: 'Riz blanc, cru', grams: 200,
    macros: { kcal: 700, protein: 14, carbs: 156, fat: 1.2 },
  });
});

test('changeGrams rescales the frozen macros of the entry', async () => {
  const { entries, meals } = setup();
  await meals.logFood('lunch', rice, 200);
  await meals.changeGrams(latest(entries), 100);
  expect(latest(entries)).toMatchObject({ grams: 100, macros: { kcal: 350, protein: 7, carbs: 78, fat: 0.6 } });
});

test('removeEntry takes the entry out of the day', async () => {
  const { entries, meals } = setup();
  await meals.logFood('lunch', rice, 100);
  await meals.removeEntry(latest(entries));
  expect(entries.entries).toEqual([]);
});

test('the day journal lists entries oldest first', async () => {
  const { clock, meals } = setup();
  const seen: string[][] = [];
  meals.observeDay('2026-10-24', (list) => seen.push(list.map((e) => e.foodName)), () => {});
  await meals.logFood('breakfast', egg, 60);
  clock.now = () => new Date('2026-10-24T10:00:00Z');
  await meals.logFood('lunch', rice, 100);
  expect(seen[seen.length - 1]).toEqual(['Oeuf', 'Riz blanc, cru']);
});

test('recents are the distinct foods of the latest entries, newest first, with their last quantity', async () => {
  const { clock, meals } = setup();
  let recents: { name: string; grams: number }[] = [];
  meals.observeRecent((list) => (recents = list), () => {});
  await meals.logFood('breakfast', egg, 60);
  clock.now = () => new Date('2026-10-24T10:00:00Z');
  await meals.logFood('lunch', rice, 150);
  clock.now = () => new Date('2026-10-24T11:00:00Z');
  await meals.logFood('lunch', egg, 120);
  expect(recents.map((r) => [r.name, r.grams])).toEqual([['Oeuf', 120], ['Riz blanc, cru', 150]]);
});

test('a saved favorite keeps the foods and quantities of the meal, and logs them back', async () => {
  const { entries, meals } = setup();
  await meals.logFood('lunch', rice, 150);
  await meals.logFood('lunch', egg, 120);
  await meals.saveFavorite('  Déjeuner habituel ', entries.entries);
  let favorites: { id: string; name: string; items: unknown[] }[] = [];
  meals.observeFavorites((list) => (favorites = list), () => {});
  expect(favorites).toHaveLength(1);
  expect(favorites[0]).toMatchObject({ name: 'Déjeuner habituel' });
  expect(favorites[0].items).toEqual([
    { foodRef: rice.ref, foodName: 'Riz blanc, cru', grams: 150 },
    { foodRef: egg.ref, foodName: 'Oeuf', grams: 120 },
  ]);

  const byRef = new Map([rice, egg].map((f) => [f.ref.id, f]));
  await meals.logFavorite(favorites[0] as never, 'dinner', async (ref) => byRef.get(ref.id));
  expect(entries.entries.filter((e) => e.meal === 'dinner').map((e) => [e.foodName, e.grams, e.macros.kcal])).toEqual([
    ['Riz blanc, cru', 150, 525],
    ['Oeuf', 120, 168],
  ]);
});

test('logFavorite skips foods that no longer exist', async () => {
  const { entries, meals } = setup();
  await meals.logFood('lunch', rice, 100);
  await meals.saveFavorite('Test', entries.entries);
  let favorite!: Parameters<typeof meals.logFavorite>[0];
  meals.observeFavorites(([first]) => (favorite = first), () => {});
  await meals.logFavorite(favorite, 'dinner', async () => undefined);
  expect(entries.entries.filter((e) => e.meal === 'dinner')).toEqual([]);
});

test('logFavorite starts every write without waiting for the server (offline writes never settle)', async () => {
  const { entries, meals } = setup();
  const add = jest.spyOn(entries, 'add').mockImplementation(() => new Promise(() => {}));
  const favorite = {
    id: 'f1', name: 'Deux', items: [
      { foodRef: rice.ref, foodName: rice.name, grams: 100 },
      { foodRef: egg.ref, foodName: egg.name, grams: 60 },
    ],
  };
  void meals.logFavorite(favorite, 'lunch', async (ref) => (ref.id === '9100' ? rice : egg));
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(add).toHaveBeenCalledTimes(2);
});

test('writes reject instead of throwing synchronously', async () => {
  const { entries, meals } = setup();
  jest.spyOn(entries, 'add').mockImplementation(() => {
    throw new Error('boom');
  });
  await expect(meals.logFood('lunch', rice, 100)).rejects.toThrow('boom');
});
