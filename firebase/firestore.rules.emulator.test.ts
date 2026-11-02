import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  increment,
  setDoc,
  setLogLevel,
  Timestamp,
  updateDoc,
  type Firestore,
} from 'firebase/firestore';
import { readFileSync } from 'node:fs';
import { NUTRIENTS } from '../src/modules/nutrition/domain/nutrients';

// Denials here are expected: without this the SDK logs each one as a warning.
setLogLevel('error');

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-genki',
    firestore: { rules: readFileSync('firebase/firestore.rules', 'utf8') },
  });
});
afterEach(() => env.clearFirestore());
afterAll(() => env.cleanup());

// rules-unit-testing hands out compat instances; the modular functions accept them.
const db = (uid?: string) =>
  (uid ? env.authenticatedContext(uid) : env.unauthenticatedContext()).firestore() as unknown as Firestore;

const seed = (path: string, data: object) =>
  env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore() as unknown as Firestore, path), data));

const entry = () => ({ day: '2026-10-23', ml: 250, createdAt: Timestamp.now(), deletedAt: null });

describe('ownership', () => {
  test('the owner reads and writes their own data', async () => {
    await assertSucceeds(setDoc(doc(db('alice'), 'users/alice/waterEntries/e1'), entry()));
    await assertSucceeds(getDoc(doc(db('alice'), 'users/alice/waterEntries/e1')));
    await assertSucceeds(setDoc(doc(db('alice'), 'users/alice/waterEntries/e2'), { ...entry(), ml: 5000 }));
  });

  test('another user or a signed-out client gets nothing', async () => {
    await seed('users/alice/waterEntries/e1', entry());
    await assertFails(getDoc(doc(db('bob'), 'users/alice/waterEntries/e1')));
    await assertFails(getDoc(doc(db(), 'users/alice/waterEntries/e1')));
    await assertFails(setDoc(doc(db('bob'), 'users/alice/waterEntries/e2'), entry()));
    await assertFails(updateDoc(doc(db('bob'), 'users/alice/waterEntries/e1'), { deletedAt: Timestamp.now() }));
    await assertFails(
      setDoc(doc(db('bob'), 'users/alice/days/2026-10-23'), { waterMl: 250, updatedAt: Timestamp.now() }),
    );
  });

  test('documents without validation yet stay closed to writes', async () => {
    await assertFails(setDoc(doc(db('alice'), 'users/alice'), { role: 'admin' }));
    await assertFails(setDoc(doc(db('alice'), 'users/alice/workoutLogs/w1'), { name: 'Séance' }));
  });
});

describe('the profile document', () => {
  const ui = () => ({ hubMetrics: ['calories', 'water'], period: 'week' });

  test('the owner saves the display preferences by merge, another user cannot, nobody deletes', async () => {
    const ref = doc(db('alice'), 'users/alice');
    await assertSucceeds(setDoc(ref, { ui: ui() }, { merge: true }));
    await assertSucceeds(setDoc(ref, { ui: { period: 'year' } }, { merge: true }));
    await assertSucceeds(setDoc(ref, { ui: { period: 'month' } }, { merge: true }));
    await assertSucceeds(getDoc(ref));
    await assertFails(getDoc(doc(db('bob'), 'users/alice')));
    await assertFails(setDoc(doc(db('bob'), 'users/alice'), { ui: ui() }, { merge: true }));
    await assertFails(deleteDoc(ref));
  });

  test.each<[string, object]>([
    ['an unknown field of the document', { role: 'admin' }],
    ['an unknown field of ui', { ui: { ...ui(), theme: 'dark' } }],
    ['a period that is not one', { ui: { period: 'quarter' } }],
    ['31 statistics', { ui: { hubMetrics: Array.from({ length: 31 }, (_, i) => `m${i}`) } }],
    ['statistics that are not a list', { ui: { hubMetrics: 'calories' } }],
    ['ui that is not a map', { ui: 'week' }],
  ])('rejects %s', async (_, data) => {
    await assertFails(setDoc(doc(db('alice'), 'users/alice'), data, { merge: true }));
  });
});

describe('the profile fields', () => {
  const profile = () => ({
    timezone: 'Europe/Paris',
    sex: 'female',
    birthYear: 1990,
    heightCm: 168.5,
    activityLevel: 'active',
    goalMode: 'deficit',
    weeklyLossKg: 0.5,
    goals: { kcal: 1800, proteinG: 120, carbsNetG: 200, fatG: 60, waterMl: 2500, steps: 9000 },
    quitDate: '2026-10-01',
    cigarettesPerDay: 15,
    packSize: 20,
    packPrice: 12.5,
    waterContainers: [{ label: 'Verre', ml: 250 }],
    createdAt: Timestamp.now(),
  });
  const save = (data: object) => setDoc(doc(db('alice'), 'users/alice'), data, { merge: true });

  test('the owner saves every field at once, then one at a time, goals field by field', async () => {
    await assertSucceeds(save(profile()));
    await assertSucceeds(save({ goals: { kcal: 2000 } }));
    await assertSucceeds(save({ heightCm: 170 }));
  });

  test.each<[string, object]>([
    ['a height of 99', { heightCm: 99 }],
    ['a birth year that is not whole', { birthYear: 1990.5 }],
    ['a sex that is neither', { sex: 'x' }],
    ['an unknown activity level', { activityLevel: 'extreme' }],
    ['an unknown goal mode', { goalMode: 'bulk' }],
    ['a weekly loss of 3 kg', { weeklyLossKg: 3 }],
    ['799 kcal', { goals: { kcal: 799 } }],
    ['an unknown goal', { goals: { carbsG: 200 } }],
    ['1 001 g of net carbs', { goals: { carbsNetG: 1001 } }],
    ['501 g of fat', { goals: { fatG: 501 } }],
    ['negative net carbs', { goals: { carbsNetG: -1 } }],
    ['fat that is not a number', { goals: { fatG: '60' } }],
    ['a quit date that is not a day', { quitDate: 'hier' }],
    ['201 cigarettes a day', { cigarettesPerDay: 201 }],
    ['a pack of 0', { packSize: 0 }],
    ['a pack at 101', { packPrice: 101 }],
    ['no container', { waterContainers: [] }],
    ['7 containers', { waterContainers: Array.from({ length: 7 }, () => ({ label: 'V', ml: 250 })) }],
    ['a container of 0 ml', { waterContainers: [{ label: 'V', ml: 0 }] }],
    ['a sixth container that is malformed', { waterContainers: [...Array.from({ length: 5 }, () => ({ label: 'V', ml: 250 })), { label: '', ml: 250 }] }],
    ['a container with an extra field', { waterContainers: [{ label: 'V', ml: 250, color: 'red' }] }],
    ['a creation time that is not a time', { createdAt: 'now' }],
  ])('rejects %s', async (_, data) => {
    await assertFails(save(data));
  });

  test('a field can be taken off by a merge', async () => {
    await assertSucceeds(save({ quitDate: '2026-10-01' }));
    await assertSucceeds(setDoc(doc(db('alice'), 'users/alice'), { quitDate: deleteField() }, { merge: true }));
  });
});

describe('waterEntries', () => {
  test.each<[string, object]>([
    ['ml is zero', { ml: 0 }],
    ['ml is above 5 000', { ml: 5001 }],
    ['ml is a string', { ml: '250' }],
    ['day is not YYYY-MM-DD', { day: '23/10/2026' }],
    ['createdAt is not a timestamp', { createdAt: 'now' }],
    ['deletedAt is already set', { deletedAt: Timestamp.now() }],
    ['an unknown field is present', { note: 'hi' }],
  ])('rejects an entry when %s', async (_, override) => {
    await assertFails(setDoc(doc(db('alice'), 'users/alice/waterEntries/e1'), { ...entry(), ...override }));
  });

  test('rejects an entry with a missing field', async () => {
    await assertFails(
      setDoc(doc(db('alice'), 'users/alice/waterEntries/e1'), { day: '2026-10-23', ml: 250, deletedAt: null }),
    );
  });

  test('an entry is soft-deleted once, and nothing else about it changes', async () => {
    await seed('users/alice/waterEntries/e1', entry());
    const ref = doc(db('alice'), 'users/alice/waterEntries/e1');
    await assertFails(updateDoc(ref, { ml: 500 }));
    await assertFails(updateDoc(ref, { ml: 500, deletedAt: Timestamp.now() }));
    await assertFails(deleteDoc(ref));
    await assertSucceeds(updateDoc(ref, { deletedAt: Timestamp.now() }));
    // A second delete would take the glass off the day total twice.
    await assertFails(updateDoc(ref, { deletedAt: Timestamp.now() }));
  });
});

describe('days', () => {
  test('accepts a water total moved by increment()', async () => {
    await assertSucceeds(
      setDoc(
        doc(db('alice'), 'users/alice/days/2026-10-23'),
        { waterMl: increment(250), updatedAt: Timestamp.now() },
        { merge: true },
      ),
    );
  });

  test.each<[string, object]>([
    ['the water total goes negative', { waterMl: -1, updatedAt: Timestamp.now() }],
    ['an unknown field is present', { waterMl: 250, updatedAt: Timestamp.now(), foo: 1 }],
    ['updatedAt is missing', { waterMl: 250 }],
  ])('rejects a day when %s', async (_, data) => {
    await assertFails(setDoc(doc(db('alice'), 'users/alice/days/2026-10-23'), data));
  });

  test('rejects a day id that is not a date', async () => {
    await assertFails(setDoc(doc(db('alice'), 'users/alice/days/today'), { waterMl: 250, updatedAt: Timestamp.now() }));
  });
});

const macros = { kcal: 350, protein: 7, carbs: 78, fat: 0.6 };
const foodEntry = () => ({
  day: '2026-10-24', meal: 'lunch', foodRef: { type: 'ciqual', id: '9100' }, foodName: 'Riz blanc, cru',
  grams: 100, macros, createdAt: Timestamp.now(), updatedAt: Timestamp.now(), deletedAt: null,
});
const customFood = () => ({
  name: 'Pain maison', state: 'other', per100g: { kcal: 250, protein: 8, carbs: 48, fat: 2 },
  portions: [{ label: '1 tranche', grams: 30 }], updatedAt: Timestamp.now(), deletedAt: null,
});

describe('foodEntries', () => {
  test('the owner creates a sound entry, another user cannot', async () => {
    await assertSucceeds(setDoc(doc(db('alice'), 'users/alice/foodEntries/e1'), foodEntry()));
    await assertFails(setDoc(doc(db('bob'), 'users/alice/foodEntries/e2'), foodEntry()));
  });

  test.each<[string, object]>([
    ['grams is 0', { grams: 0 }],
    ['grams is above 5 000', { grams: 5001 }],
    ['the meal is unknown', { meal: 'brunch' }],
    ['the day is not a date', { day: 'hier' }],
    ['the food reference type is unknown', { foodRef: { type: 'usda', id: '1' } }],
    ['the food name is empty', { foodName: '' }],
    ['a macro is negative', { macros: { ...macros, fat: -1 } }],
    ['kcal is above 50 000', { macros: { ...macros, kcal: 50001 } }],
    ['protein is above 5 000', { macros: { ...macros, protein: 5001 } }],
    ['carbs is above 5 000', { macros: { ...macros, carbs: 5001 } }],
    ['fat is above 5 000', { macros: { ...macros, fat: 5001 } }],
    ['a macro is missing', { macros: { kcal: 1, protein: 1, carbs: 1 } }],
    ['deletedAt is already set', { deletedAt: Timestamp.now() }],
    ['an unknown field is present', { note: 'x' }],
  ])('rejects an entry when %s', async (_, override) => {
    await assertFails(setDoc(doc(db('alice'), 'users/alice/foodEntries/e1'), { ...foodEntry(), ...override }));
  });

  test('the quantity, group and time can change but nothing else, and the entry is soft-deleted once', async () => {
    await seed('users/alice/foodEntries/e1', foodEntry());
    const ref = doc(db('alice'), 'users/alice/foodEntries/e1');
    await assertFails(updateDoc(ref, { foodName: 'Autre' }));
    await assertFails(updateDoc(ref, { grams: 0, macros, updatedAt: Timestamp.now() }));
    await assertFails(updateDoc(ref, { grams: 200, macros, updatedAt: Timestamp.now(), foodName: 'Autre' }));
    await assertSucceeds(updateDoc(ref, { grams: 200, macros: { ...macros, kcal: 700 }, updatedAt: Timestamp.now() }));
    await assertFails(deleteDoc(ref));
    await assertSucceeds(updateDoc(ref, { deletedAt: Timestamp.now() }));
    await assertFails(updateDoc(ref, { deletedAt: Timestamp.now() }));
    await assertFails(updateDoc(ref, { grams: 100, macros, updatedAt: Timestamp.now() }));
  });

  test('the group, the day and the time can change with the quantity', async () => {
    await seed('users/alice/foodEntries/e1', foodEntry());
    const ref = doc(db('alice'), 'users/alice/foodEntries/e1');
    const when = { grams: 100, macros, updatedAt: Timestamp.now() };
    await assertSucceeds(updateDoc(ref, { ...when, meal: 'dinner', day: '2026-10-23', createdAt: Timestamp.fromDate(new Date('2026-10-23T18:00:00Z')) }));
  });

  test.each<[string, object]>([
    ['the day is not a date', { day: 'hier' }],
    ['the meal is unknown', { meal: 'brunch' }],
    ['the time is not a timestamp', { createdAt: 'midi' }],
    ['the food name changes', { foodName: 'Autre' }],
    ['the food reference changes', { foodRef: { type: 'custom', id: 'x' } }],
  ])('a change of time is refused when %s', async (_, patch) => {
    await seed('users/alice/foodEntries/e1', foodEntry());
    await assertFails(updateDoc(doc(db('alice'), 'users/alice/foodEntries/e1'), { grams: 100, macros, updatedAt: Timestamp.now(), ...patch }));
  });

  test('an entry may carry the nutrients of its portion', async () => {
    await assertSucceeds(setDoc(doc(db('alice'), 'users/alice/foodEntries/e1'), { ...foodEntry(), nutrients: { iron: 1.9, vitD: 0, fiber: 1000000 } }));
    await assertSucceeds(setDoc(doc(db('alice'), 'users/alice/foodEntries/e2'), { ...foodEntry(), nutrients: {} }));
  });

  test('an entry may carry all 26 nutrients, on creation and on a change of quantity (Ciqual gives that many to most foods)', async () => {
    const all = Object.fromEntries(NUTRIENTS.map((n, i) => [n.id, i + 0.5]));
    expect(Object.keys(all)).toHaveLength(26);
    await assertSucceeds(setDoc(doc(db('alice'), 'users/alice/foodEntries/e1'), { ...foodEntry(), nutrients: all }));
    const ref = doc(db('alice'), 'users/alice/foodEntries/e1');
    await assertSucceeds(updateDoc(ref, { grams: 200, macros: { ...macros, kcal: 700 }, nutrients: all, updatedAt: Timestamp.now() }));
  });

  test.each<[string, object]>([
    ['a nutrient is unknown', { nutrients: { vitamin: 1 } }],
    ['a nutrient is negative', { nutrients: { iron: -0.1 } }],
    ['a nutrient is above 1 000 000', { nutrients: { iron: 1000001 } }],
    ['a nutrient is not a number', { nutrients: { iron: '2' } }],
    ['nutrients is not a map', { nutrients: 5 }],
  ])('rejects an entry when %s', async (_, override) => {
    await assertFails(setDoc(doc(db('alice'), 'users/alice/foodEntries/e1'), { ...foodEntry(), ...override }));
  });

  test('a change of quantity may rewrite the nutrients, within the same bounds', async () => {
    await seed('users/alice/foodEntries/e1', { ...foodEntry(), nutrients: { iron: 1 } });
    const ref = doc(db('alice'), 'users/alice/foodEntries/e1');
    await assertFails(updateDoc(ref, { grams: 200, macros, nutrients: { iron: -2 }, updatedAt: Timestamp.now() }));
    await assertFails(updateDoc(ref, { grams: 200, macros, nutrients: { calcium: 'x' }, updatedAt: Timestamp.now() }));
    await assertSucceeds(updateDoc(ref, { grams: 200, macros: { ...macros, kcal: 700 }, nutrients: { iron: 2 }, updatedAt: Timestamp.now() }));
  });

  test('another user cannot update an entry', async () => {
    await seed('users/alice/foodEntries/e1', foodEntry());
    await assertFails(updateDoc(doc(db('bob'), 'users/alice/foodEntries/e1'), { deletedAt: Timestamp.now() }));
  });
});

describe('foods', () => {
  test('the owner creates, edits and soft-deletes a custom food', async () => {
    await assertSucceeds(setDoc(doc(db('alice'), 'users/alice/foods/f1'), customFood()));
    const ref = doc(db('alice'), 'users/alice/foods/f1');
    await assertSucceeds(updateDoc(ref, { name: 'Pain de mie', updatedAt: Timestamp.now() }));
    await assertFails(updateDoc(ref, { deletedAt: null, name: 'x', updatedAt: Timestamp.now(), foo: 1 }));
    await assertSucceeds(updateDoc(ref, { deletedAt: Timestamp.now() }));
    await assertFails(updateDoc(ref, { name: 'Trop tard', updatedAt: Timestamp.now() }));
    await assertFails(deleteDoc(ref));
  });

  test('a food may come from Open Food Facts, with its brand, barcode and nutrients', async () => {
    await assertSucceeds(setDoc(doc(db('alice'), 'users/alice/foods/f1'), { ...customFood(), source: 'off', brand: 'Coca-Cola', barcode: '5449000000996', nutrients: { sugars: 10.6, vitC: 0 } }));
    await assertSucceeds(setDoc(doc(db('alice'), 'users/alice/foods/f2'), { ...customFood(), barcode: '12345678' }));
  });

  test.each<[string, object]>([
    ['the barcode is not numeric', { barcode: '54490abc' }],
    ['the barcode has 7 digits', { barcode: '1234567' }],
    ['the barcode has 15 digits', { barcode: '123456789012345' }],
    ['the barcode is a number', { barcode: 5449000000996 }],
    ['the source is unknown', { source: 'usda' }],
    ['the brand is not text', { brand: 12 }],
    ['the brand is 101 characters', { brand: 'x'.repeat(101) }],
    ['a nutrient is unknown', { nutrients: { vitamin: 1 } }],
    ['a nutrient is above 1 000 000', { nutrients: { iron: 1000001 } }],
  ])('rejects a food when %s', async (_, override) => {
    await assertFails(setDoc(doc(db('alice'), 'users/alice/foods/f1'), { ...customFood(), ...override }));
  });

  test('the micronutrients of a food can be added, rewritten and removed, within their bounds', async () => {
    await seed('users/alice/foods/f1', customFood());
    const ref = doc(db('alice'), 'users/alice/foods/f1');
    await assertSucceeds(updateDoc(ref, { nutrients: { magnesium: 60000, vitD: 0.5 }, updatedAt: Timestamp.now() }));
    await assertSucceeds(updateDoc(ref, { nutrients: { magnesium: 30000 }, updatedAt: Timestamp.now() }));
    await assertFails(updateDoc(ref, { nutrients: { magnesium: -1 }, updatedAt: Timestamp.now() }));
    await assertFails(updateDoc(ref, { nutrients: { magnesium: 1000001 }, updatedAt: Timestamp.now() }));
    await assertFails(updateDoc(ref, { nutrients: { vitamin: 1 }, updatedAt: Timestamp.now() }));
    await assertSucceeds(updateDoc(ref, { nutrients: deleteField(), updatedAt: Timestamp.now() }));
  });

  test('the source, brand and barcode of a food are not changed afterwards', async () => {
    await seed('users/alice/foods/f1', { ...customFood(), source: 'off', brand: 'Coca-Cola', barcode: '5449000000996' });
    const ref = doc(db('alice'), 'users/alice/foods/f1');
    await assertFails(updateDoc(ref, { barcode: '12345678', updatedAt: Timestamp.now() }));
    await assertFails(updateDoc(ref, { source: 'off', brand: 'Autre', updatedAt: Timestamp.now() }));
    await assertSucceeds(updateDoc(ref, { name: 'Coca-Cola, canette', brand: 'Coca-Cola', updatedAt: Timestamp.now() }));
  });

  test.each<[string, object]>([
    ['the name is empty', { name: '' }],
    ['the state is unknown', { state: 'frozen' }],
    ['kcal per 100 g is above 900', { per100g: { kcal: 901, protein: 0, carbs: 0, fat: 0 } }],
    ['protein per 100 g is above 100', { per100g: { kcal: 400, protein: 101, carbs: 0, fat: 0 } }],
    ['carbs per 100 g is above 100', { per100g: { kcal: 400, protein: 0, carbs: 101, fat: 0 } }],
    ['fat per 100 g is above 100', { per100g: { kcal: 400, protein: 0, carbs: 0, fat: 101 } }],
    ['there are 21 portions', { portions: Array.from({ length: 21 }, () => ({ label: 'p', grams: 1 })) }],
    ['portions is not a list', { portions: 'une' }],
    ['an unknown field is present', { note: 'x' }],
    ['deletedAt is already set', { deletedAt: Timestamp.now() }],
  ])('rejects a food when %s', async (_, override) => {
    await assertFails(setDoc(doc(db('alice'), 'users/alice/foods/f1'), { ...customFood(), ...override }));
  });

  test('another user can neither create, edit nor delete a food', async () => {
    await assertFails(setDoc(doc(db('bob'), 'users/alice/foods/f1'), customFood()));
    await seed('users/alice/foods/f1', customFood());
    const ref = doc(db('bob'), 'users/alice/foods/f1');
    await assertFails(updateDoc(ref, { name: 'Pain de mie', updatedAt: Timestamp.now() }));
    await assertFails(updateDoc(ref, { deletedAt: Timestamp.now() }));
  });
});

describe('favoriteMeals', () => {
  const favorite = () => ({
    name: 'Déjeuner habituel', items: [{ foodRef: { type: 'ciqual', id: '9100' }, foodName: 'Riz blanc, cru', grams: 150 }], updatedAt: Timestamp.now(),
  });

  test('the owner creates, edits and deletes a favorite', async () => {
    const ref = doc(db('alice'), 'users/alice/favoriteMeals/m1');
    await assertSucceeds(setDoc(ref, favorite()));
    await assertSucceeds(setDoc(ref, { ...favorite(), name: 'Autre nom' }));
    await assertSucceeds(deleteDoc(ref));
  });

  test.each<[string, object]>([
    ['the name is empty', { name: '' }],
    ['there are no items', { items: [] }],
    ['there are 51 items', { items: Array.from({ length: 51 }, () => ({ foodRef: { type: 'ciqual', id: '1' }, foodName: 'x', grams: 1 })) }],
    ['an unknown field is present', { note: 'x' }],
  ])('rejects a favorite when %s', async (_, override) => {
    await assertFails(setDoc(doc(db('alice'), 'users/alice/favoriteMeals/m1'), { ...favorite(), ...override }));
  });

  test('another user cannot delete', async () => {
    await seed('users/alice/favoriteMeals/m1', favorite());
    await assertFails(deleteDoc(doc(db('bob'), 'users/alice/favoriteMeals/m1')));
  });

  test.each<[string, string | undefined]>([
    ['another user', 'bob'],
    ['a signed-out client', undefined],
  ])('%s can neither create nor update a favorite', async (_, uid) => {
    const ref = doc(db(uid), 'users/alice/favoriteMeals/m1');
    await assertFails(setDoc(ref, favorite()));
    await seed('users/alice/favoriteMeals/m1', favorite());
    await assertFails(setDoc(ref, { ...favorite(), name: 'Autre nom' }));
  });
});

describe('days (nutrition totals)', () => {
  test('accepts macro totals moved by increment(), with or without water', async () => {
    await assertSucceeds(setDoc(doc(db('alice'), 'users/alice/days/2026-10-24'), { kcal: increment(350), proteinG: increment(7), carbsG: increment(78), fatG: increment(0.6), updatedAt: Timestamp.now() }, { merge: true }));
    await assertSucceeds(setDoc(doc(db('alice'), 'users/alice/days/2026-10-25'), { waterMl: increment(250), updatedAt: Timestamp.now() }, { merge: true }));
  });

  test('tolerates a drift of 0.01 below zero on macros but rejects 0.1, and never on water', async () => {
    await assertSucceeds(setDoc(doc(db('alice'), 'users/alice/days/2026-10-24'), { kcal: -0.01, updatedAt: Timestamp.now() }));
    await assertFails(setDoc(doc(db('alice'), 'users/alice/days/2026-10-24'), { kcal: -0.1, updatedAt: Timestamp.now() }));
    await assertFails(setDoc(doc(db('alice'), 'users/alice/days/2026-10-24'), { waterMl: -0.01, updatedAt: Timestamp.now() }));
  });

  test.each(['proteinG', 'carbsG', 'fatG'])('%s tolerates a drift of 0.01 below zero but rejects 0.1', async (field) => {
    const ref = doc(db('alice'), 'users/alice/days/2026-10-24');
    await assertSucceeds(setDoc(ref, { [field]: -0.01, updatedAt: Timestamp.now() }));
    await assertFails(setDoc(ref, { [field]: -0.1, updatedAt: Timestamp.now() }));
  });

  test('rejects a total that is not a number', async () => {
    await assertFails(setDoc(doc(db('alice'), 'users/alice/days/2026-10-24'), { proteinG: '12', updatedAt: Timestamp.now() }));
  });

  describe('the steps', () => {
    const day = () => doc(db('alice'), 'users/alice/days/2026-10-24');
    const steps = (data: object) => setDoc(day(), { updatedAt: Timestamp.now(), ...data }, { merge: true });

    test('the steps, their source and the time of the sync are merged into the day, next to the totals', async () => {
      await assertSucceeds(setDoc(day(), { kcal: 1800, updatedAt: Timestamp.now() }));
      await assertSucceeds(steps({ steps: 8342, stepsSource: 'fitbit', stepsSyncedAt: Timestamp.now() }));
      await assertSucceeds(steps({ steps: 0, stepsSource: 'phone' }));
    });

    test.each<[string, object]>([
      ['negative steps', { steps: -1 }],
      ['200 001 steps', { steps: 200001 }],
      ['steps that are a string', { steps: '8000' }],
      ['a source that is neither', { stepsSource: 'garmin' }],
      ['a sync time that is not a time', { stepsSyncedAt: 'now' }],
    ])('rejects %s', async (_, data) => {
      await assertFails(steps(data));
    });
  });

  describe('the measures of the body', () => {
    const day = () => doc(db('alice'), 'users/alice/days/2026-10-24');
    const measure = (data: object) => setDoc(day(), { updatedAt: Timestamp.now(), ...data }, { merge: true });

    test('a weight and a waist are merged into the day, next to the totals', async () => {
      await assertSucceeds(setDoc(day(), { kcal: 1800, updatedAt: Timestamp.now() }));
      await assertSucceeds(measure({ weightKg: 80.5 }));
      await assertSucceeds(measure({ waistCm: 92 }));
    });

    test.each<[string, object]>([
      ['a weight of 19 kg', { weightKg: 19 }],
      ['a weight of 401 kg', { weightKg: 401 }],
      ['a weight that is a string', { weightKg: '80' }],
      ['a waist of 29 cm', { waistCm: 29 }],
      ['a waist of 301 cm', { waistCm: 301 }],
    ])('rejects %s', async (_, data) => {
      await assertFails(measure(data));
    });
  });
});

describe('devices', () => {
  const device = () => ({ name: 'Pixel', stepsWriter: true, lastStepsSyncAt: Timestamp.now() });

  test('the owner notes a device, changes its role and removes it, another user cannot', async () => {
    const ref = doc(db('alice'), 'users/alice/devices/d1');
    await assertSucceeds(setDoc(ref, device()));
    await assertSucceeds(setDoc(ref, { stepsWriter: false }, { merge: true }));
    await assertFails(setDoc(doc(db('bob'), 'users/alice/devices/d2'), device()));
    await assertFails(deleteDoc(doc(db('bob'), 'users/alice/devices/d1')));
    await assertSucceeds(deleteDoc(ref));
  });

  test.each<[string, object]>([
    ['an extra field', { note: 'x' }],
    ['a role that is not a boolean', { stepsWriter: 'yes' }],
    ['a name of 101 characters', { name: 'x'.repeat(101) }],
    ['a blank name', { name: '' }],
    ['a sync time that is not a time', { lastStepsSyncAt: 'now' }],
  ])('rejects %s', async (_, patch) => {
    await assertFails(setDoc(doc(db('alice'), 'users/alice/devices/d1'), { ...device(), ...patch }));
  });
});

describe('plans', () => {
  const phases = (n = 1) => Array.from({ length: n }, (_, i) => ({ name: `Phase ${i}`, weeks: 4, sessions: [{ name: 'A', exercises: [{ exerciseId: 'squat', name: 'Squat', sets: 3, reps: 8, incrementKg: 2.5 }] }] }));
  const plan = () => ({ name: 'Reprise', active: true, startDay: '2026-11-02', phases: phases(), updatedAt: Timestamp.now() });

  test('the owner creates, edits and deletes a programme, another user cannot', async () => {
    const ref = doc(db('alice'), 'users/alice/plans/p1');
    await assertSucceeds(setDoc(ref, plan()));
    await assertSucceeds(setDoc(ref, { ...plan(), name: 'Autre nom' }));
    await assertFails(setDoc(doc(db('bob'), 'users/alice/plans/p2'), plan()));
    await assertFails(deleteDoc(doc(db('bob'), 'users/alice/plans/p1')));
    await assertSucceeds(deleteDoc(ref));
  });

  test.each<[string, object]>([
    ['an extra field', { extra: 1 }],
    ['a blank name', { name: '' }],
    ['a name of 101 characters', { name: 'x'.repeat(101) }],
    ['an active flag that is not a boolean', { active: 'oui' }],
    ['a start day that is not a day', { startDay: 'demain' }],
    ['no phase', { phases: [] }],
    ['13 phases', { phases: phases(13) }],
    ['phases that are not a list', { phases: 'beaucoup' }],
    ['no update time', { updatedAt: 'now' }],
  ])('rejects %s', async (_, patch) => {
    await assertFails(setDoc(doc(db('alice'), 'users/alice/plans/p1'), { ...plan(), ...patch }));
  });
});

describe('workoutLogs', () => {
  const log = () => ({
    day: '2026-11-03',
    planId: 'p1',
    sessionName: 'Séance A',
    exerciseIds: ['squat'],
    sets: [{ exerciseId: 'squat', setNo: 1, reps: 8, kg: 20 }],
    durationMin: 45,
    createdAt: Timestamp.now(),
    deletedAt: null,
  });

  test('the owner records a workout, another user cannot, and nobody changes or deletes it', async () => {
    const ref = doc(db('alice'), 'users/alice/workoutLogs/w1');
    await assertSucceeds(setDoc(ref, log()));
    await assertFails(setDoc(doc(db('bob'), 'users/alice/workoutLogs/w2'), log()));
    await assertFails(updateDoc(ref, { durationMin: 50 }));
    await assertFails(setDoc(ref, { ...log(), durationMin: 50 }));
    await assertFails(deleteDoc(ref));
  });

  test('accepts the 400 sets of 20 exercises of 20 sets, and a day-long session', async () => {
    const sets = Array.from({ length: 400 }, () => ({ exerciseId: 'squat', setNo: 1, reps: 8, kg: 20 }));
    await assertSucceeds(setDoc(doc(db('alice'), 'users/alice/workoutLogs/w1'), { ...log(), sets, durationMin: 1440 }));
  });

  test.each<[string, object]>([
    ['an extra field', { extra: 1 }],
    ['a day that is not a day', { day: 'hier' }],
    ['a blank session name', { sessionName: '' }],
    ['no exercise', { exerciseIds: [] }],
    ['21 exercises', { exerciseIds: Array.from({ length: 21 }, (_, i) => `e${i}`) }],
    ['no set', { sets: [] }],
    ['401 sets', { sets: Array.from({ length: 401 }, () => ({ exerciseId: 'squat', setNo: 1, reps: 8, kg: 20 })) }],
    ['a duration of 0', { durationMin: 0 }],
    ['a duration above a day', { durationMin: 1441 }],
    ['a fractional duration', { durationMin: 45.5 }],
    ['a deletion mark', { deletedAt: Timestamp.now() }],
    ['a creation time that is not a time', { createdAt: 'now' }],
  ])('rejects %s', async (_, patch) => {
    await assertFails(setDoc(doc(db('alice'), 'users/alice/workoutLogs/w1'), { ...log(), ...patch }));
  });
});

describe('milestones', () => {
  const milestone = () => ({ metric: 'exercise:tractions:reps', target: 10, direction: 'up', label: '10 tractions' });

  test('the owner creates and deletes a milestone, another user cannot', async () => {
    const ref = doc(db('alice'), 'users/alice/milestones/m1');
    await assertSucceeds(setDoc(ref, milestone()));
    await assertFails(setDoc(doc(db('bob'), 'users/alice/milestones/m2'), milestone()));
    await assertFails(deleteDoc(doc(db('bob'), 'users/alice/milestones/m1')));
    await assertSucceeds(deleteDoc(ref));
  });

  test('accepts the longest metric an exercise name can make, and no longer', async () => {
    const metric = (idLength: number) => `exercise:${'a'.repeat(idLength)}:kg`;
    await assertSucceeds(setDoc(doc(db('alice'), 'users/alice/milestones/m1'), { ...milestone(), metric: metric(100) }));
    await assertFails(setDoc(doc(db('alice'), 'users/alice/milestones/m2'), { ...milestone(), metric: metric(109) }));
  });

  test.each<[string, object]>([
    ['an extra field', { extra: 1 }],
    ['a blank label', { label: '' }],
    ['a negative target', { target: -1 }],
    ['a target above 100 000', { target: 100001 }],
    ['a target that is not a number', { target: '10' }],
    ['a direction that is neither up nor down', { direction: 'sideways' }],
    ['no metric', { metric: '' }],
    ['an achievement set at creation', { achievedAt: Timestamp.now() }],
  ])('rejects %s', async (_, patch) => {
    await assertFails(setDoc(doc(db('alice'), 'users/alice/milestones/m1'), { ...milestone(), ...patch }));
  });

  test('achievedAt is set once, and nothing else changes', async () => {
    await seed('users/alice/milestones/m1', milestone());
    const ref = doc(db('alice'), 'users/alice/milestones/m1');
    await assertFails(updateDoc(ref, { target: 12 }));
    await assertFails(updateDoc(ref, { achievedAt: 'hier' }));
    await assertFails(updateDoc(ref, { achievedAt: Timestamp.now(), target: 12 }));
    await assertSucceeds(updateDoc(ref, { achievedAt: Timestamp.now() }));
    await assertFails(updateDoc(ref, { achievedAt: Timestamp.now() }));
  });

  test('another user cannot mark one achieved', async () => {
    await seed('users/alice/milestones/m1', milestone());
    await assertFails(updateDoc(doc(db('bob'), 'users/alice/milestones/m1'), { achievedAt: Timestamp.now() }));
  });
});
