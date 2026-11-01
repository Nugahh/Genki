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

/** A change of quantity alone: the group and the time stay. */
const sameTime = (entry: FoodEntry, grams: number) => ({ grams, meal: entry.meal, at: entry.createdAt });
const latest = (entries: { entries: FoodEntry[] }) => entries.entries[entries.entries.length - 1];
const BAD_GRAMS = 'La quantité doit être comprise entre 0 et 5 000 g.';
const BAD_FAVORITE = 'Un favori a un nom et 1 à 50 aliments.';

test('logFood freezes the macros of the quantity and uses the profile-zone day', async () => {
  const { entries, meals } = setup('2026-10-24T22:10:00Z'); // 00:10 in Paris, already the 25th
  await meals.logFood('snack', rice, 200);
  expect(latest(entries)).toMatchObject({
    day: '2026-10-25', meal: 'snack', foodRef: rice.ref, foodName: 'Riz blanc, cru', grams: 200,
    macros: { kcal: 700, protein: 14, carbs: 156, fat: 1.2 },
  });
});

test('updateEntry rescales the frozen macros of the entry', async () => {
  const { entries, meals } = setup();
  await meals.logFood('lunch', rice, 200);
  await meals.updateEntry(latest(entries), sameTime(latest(entries), 100));
  expect(latest(entries)).toMatchObject({ grams: 100, macros: { kcal: 350, protein: 7, carbs: 78, fat: 0.6 } });
});

test('removeEntry takes the entry out of the day', async () => {
  const { entries, meals } = setup();
  await meals.logFood('lunch', rice, 100);
  await meals.removeEntry(latest(entries));
  expect(entries.entries).toEqual([]);
});

test('the day journal lists entries oldest first', async () => {
  const { clock, meals } = setup('2026-10-24T10:00:00Z');
  const seen: string[][] = [];
  meals.observeDay('2026-10-24', (list) => seen.push(list.map((e) => e.foodName)), () => {});
  await meals.logFood('lunch', rice, 100);
  clock.now = () => new Date('2026-10-24T09:00:00Z'); // logged second, but eaten earlier
  await meals.logFood('breakfast', egg, 60);
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

test('favorites are listed by name in French collation, not in the order they were saved', async () => {
  const { entries, meals } = setup();
  await meals.logFood('lunch', rice, 100);
  for (const name of ['Zèbre', 'éclair', 'Abricot', 'Épeautre']) await meals.saveFavorite(name, entries.entries);
  let names: string[] = [];
  meals.observeFavorites((list) => (names = list.map((f) => f.name)), () => {})();
  expect(names).toEqual(['Abricot', 'éclair', 'Épeautre', 'Zèbre']);
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

test('logFavorite logs the foods that still exist and skips the others', async () => {
  const { entries, meals } = setup();
  const favorite = {
    id: 'f1', name: 'Mixte', items: [
      { foodRef: egg.ref, foodName: egg.name, grams: 60 },
      { foodRef: rice.ref, foodName: rice.name, grams: 100 },
    ],
  };
  await meals.logFavorite(favorite, 'dinner', async (ref) => (ref.id === rice.ref.id ? rice : undefined));
  expect(entries.entries.map((e) => [e.foodName, e.grams])).toEqual([['Riz blanc, cru', 100]]);
});

test('logFavorite spaces its entries by 1 ms in the favorite order, all on the day it started', async () => {
  const { entries, meals } = setup('2026-10-24T21:59:59.999Z'); // 23:59:59.999 in Paris: the next entry is past midnight
  const favorite = {
    id: 'f1', name: 'Deux', items: [
      { foodRef: rice.ref, foodName: rice.name, grams: 100 },
      { foodRef: egg.ref, foodName: egg.name, grams: 60 },
    ],
  };
  await meals.logFavorite(favorite, 'dinner', async (ref) => (ref.id === rice.ref.id ? rice : egg));
  expect(entries.entries.map((e) => [e.foodName, e.day, e.createdAt.toISOString()])).toEqual([
    ['Riz blanc, cru', '2026-10-24', '2026-10-24T21:59:59.999Z'],
    ['Oeuf', '2026-10-24', '2026-10-24T22:00:00.000Z'],
  ]);
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

test('logFood rejects a quantity outside ]0 ; 5 000] g and writes nothing', async () => {
  const { entries, meals } = setup();
  for (const grams of [0, -1, 5001, Number.NaN]) await expect(meals.logFood('lunch', rice, grams)).rejects.toThrow(BAD_GRAMS);
  expect(entries.entries).toEqual([]);
  await meals.logFood('lunch', rice, 5000); // the upper bound itself is allowed
  expect(entries.entries).toHaveLength(1);
});

test('updateEntry rejects a quantity outside ]0 ; 5 000] g and leaves the entry alone', async () => {
  const { entries, meals } = setup();
  await meals.logFood('lunch', rice, 100);
  const entry = latest(entries);
  for (const grams of [0, -1, 5001, Number.NaN]) await expect(meals.updateEntry(entry, sameTime(entry, grams))).rejects.toThrow(BAD_GRAMS);
  expect(latest(entries)).toMatchObject({ grams: 100 });
  await meals.updateEntry(entry, sameTime(entry, 5000)); // the upper bound itself is allowed
  expect(latest(entries)).toMatchObject({ grams: 5000 });
});

test('saveFavorite rejects a blank name and a list of 0 or more than 50 foods', async () => {
  const { entries, meals } = setup();
  await meals.logFood('lunch', rice, 100);
  const [entry] = entries.entries;
  let saved = 0;
  meals.observeFavorites((list) => (saved = list.length), () => {});
  await expect(meals.saveFavorite('   ', [entry])).rejects.toThrow(BAD_FAVORITE);
  await expect(meals.saveFavorite('Vide', [])).rejects.toThrow(BAD_FAVORITE);
  await expect(meals.saveFavorite('Trop', Array(51).fill(entry))).rejects.toThrow(BAD_FAVORITE);
  expect(saved).toBe(0);
  await meals.saveFavorite('Limite', Array(50).fill(entry)); // the bound itself is allowed
  expect(saved).toBe(1);
});

describe('nutrients', () => {
  const orange: Food = {
    ref: { type: 'ciqual', id: '13014' }, name: 'Orange, pulpe, crue', state: 'raw',
    per100g: { kcal: 45, protein: 0.9, carbs: 9, fat: 0.2 }, portions: [], nutrients: { vitC: 50, fiber: 1.8 },
  };

  test('logFood freezes the nutrients of the quantity', async () => {
    const { entries, meals } = setup();
    await meals.logFood('snack', orange, 200);
    expect(latest(entries).nutrients).toEqual({ vitC: 100, fiber: 3.6 });
  });

  test('a food with no nutrients gives an entry with none', async () => {
    const { entries, meals } = setup();
    await meals.logFood('lunch', egg, 120);
    expect(latest(entries)).not.toHaveProperty('nutrients');
  });

  test('updateEntry rescales them from the frozen values of the entry', async () => {
    const { entries, meals } = setup();
    await meals.logFood('snack', orange, 200);
    await meals.updateEntry(latest(entries), sameTime(latest(entries), 100));
    expect(latest(entries).nutrients).toEqual({ vitC: 50, fiber: 1.8 });
    await meals.logFood('lunch', egg, 100);
    await meals.updateEntry(latest(entries), sameTime(latest(entries), 50));
    expect(latest(entries)).not.toHaveProperty('nutrients');
  });

  test('a favorite logs the nutrients of the foods it resolves to', async () => {
    const { entries, meals } = setup();
    const favorite = { id: 'f1', name: 'Goûter', items: [{ foodRef: orange.ref, foodName: orange.name, grams: 150 }] };
    await meals.logFavorite(favorite, 'snack', async () => orange);
    expect(latest(entries).nutrients).toEqual({ vitC: 75, fiber: 2.7 });
  });

  test('observeBetween lists the entries of the days from one date to another', async () => {
    const { meals } = setup();
    await meals.logFood('lunch', orange, 100); // 2026-10-24
    const seen: number[] = [];
    const stop = meals.observeBetween('2026-10-24', '2026-10-30', (list) => seen.push(list.length), () => {});
    const outside: number[] = [];
    meals.observeBetween('2026-10-25', '2026-10-30', (list) => outside.push(list.length), () => {})();
    stop();
    expect([seen, outside]).toEqual([[1], [0]]);
  });
});

describe('the time of an entry', () => {
  // 2026-10-24 09:00 UTC is 11:00 in Paris.
  test('logFood can log at an earlier time: the day is that of the zone, the entry has that time', async () => {
    const { entries, meals } = setup();
    const at = new Date('2026-10-22T22:30:00Z'); // 00:30 in Paris on the 23rd
    await meals.logFood('dinner', rice, 100, at);
    expect(latest(entries)).toMatchObject({ day: '2026-10-23', createdAt: at, meal: 'dinner' });
  });

  test('logFood refuses the future and more than a year back, and logs nothing', async () => {
    const { entries, meals } = setup();
    await expect(meals.logFood('lunch', rice, 100, new Date('2026-10-24T09:01:00Z'))).rejects.toThrow('L’heure choisie');
    await expect(meals.logFood('lunch', rice, 100, new Date('2025-10-23T08:59:00Z'))).rejects.toThrow('L’heure choisie');
    expect(entries.entries).toEqual([]);
  });

  test('updateEntry changes the group and the time: the day follows, the values follow the quantity', async () => {
    const { entries, meals } = setup();
    await meals.logFood('lunch', rice, 200);
    const at = new Date('2026-10-22T22:30:00Z');
    await meals.updateEntry(latest(entries), { grams: 100, meal: 'snack', at });
    expect(latest(entries)).toMatchObject({ grams: 100, meal: 'snack', day: '2026-10-23', createdAt: at, macros: { kcal: 350, protein: 7, carbs: 78, fat: 0.6 } });
  });

  test('updateEntry refuses a time in the future and leaves the entry alone', async () => {
    const { entries, meals } = setup();
    await meals.logFood('lunch', rice, 200);
    const before = latest(entries);
    await expect(meals.updateEntry(before, { grams: 100, meal: 'lunch', at: new Date('2026-10-25T09:00:00Z') })).rejects.toThrow('L’heure choisie');
    expect(latest(entries)).toEqual(before);
  });

  test('an entry keeps a time that is further back than a new one may be when only the quantity changes', async () => {
    const { entries, meals } = setup();
    await entries.add({ day: '2024-01-05', meal: 'lunch', foodRef: rice.ref, foodName: rice.name, grams: 100, macros: { kcal: 350, protein: 7, carbs: 78, fat: 0.6 }, createdAt: new Date('2024-01-05T11:00:00Z') });
    await meals.updateEntry(latest(entries), sameTime(latest(entries), 200));
    expect(latest(entries)).toMatchObject({ grams: 200, day: '2024-01-05' });
  });
});
