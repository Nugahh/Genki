import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { setLogLevel, type Firestore } from 'firebase/firestore';
import { readFileSync } from 'node:fs';
import type { Food } from '../domain/food';
import { firestoreFoodRepository } from './firestoreFoodRepository';

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

const phone = () => env.authenticatedContext('alice').firestore() as unknown as Firestore;
// The adapter is typed for React Native Firebase; here it runs on the web SDK (jest.emulator.config.js).
const foodsOn = (db: Firestore) => firestoreFoodRepository(db as never, 'alice');

const bread = () => ({
  name: 'Pain maison', state: 'other' as const, per100g: { kcal: 250, protein: 8, carbs: 48, fat: 2 },
  portions: [{ label: '1 tranche', grams: 30 }],
});

const foods = (db: Firestore) =>
  new Promise<Food[]>((resolve, reject) => {
    const stop = foodsOn(db).observeAll((list) => {
      stop();
      resolve(list);
    }, reject);
  });

test('a created food is listed with a generated id, its values and its portions intact', async () => {
  const db = phone();
  await foodsOn(db).add(bread()).write();
  expect(await foods(db)).toEqual([{ ref: { type: 'custom', id: expect.any(String) }, ...bread() }]);
});

test('updating a food changes it in the list', async () => {
  const db = phone();
  await foodsOn(db).add(bread()).write();
  const [created] = await foods(db);
  await foodsOn(db).update(created.ref.id, { ...bread(), name: 'Pain de mie' });
  expect(await foods(db)).toEqual([{ ...created, name: 'Pain de mie' }]);
});

test('a removed food leaves the list', async () => {
  const db = phone();
  await foodsOn(db).add(bread()).write();
  const [created] = await foods(db);
  await foodsOn(db).remove(created.ref.id);
  expect(await foods(db)).toEqual([]);
});

test('a food the rules refuse is rejected', async () => {
  await expect(foodsOn(phone()).add({ ...bread(), per100g: { kcal: 1000, protein: 8, carbs: 48, fat: 2 } }).write()).rejects.toThrow();
});

const coca = () => ({
  name: 'Coca-Cola', state: 'other' as const, per100g: { kcal: 42.4, protein: 0, carbs: 10.6, fat: 0 },
  portions: [{ label: 'Portion 330 ml ≈ 330 g', grams: 330 }],
  nutrients: { sugars: 10.6, salt: 0 }, source: 'off' as const, brand: 'Coca-Cola Services', barcode: '5449000000996',
});

test('the id of a new food is known before it is written', async () => {
  const db = phone();
  const { id, write } = foodsOn(db).add(bread());
  expect(id).toEqual(expect.any(String));
  expect(await foods(db)).toEqual([]); // nothing is written until `write` runs
  await write();
  expect((await foods(db))[0].ref.id).toBe(id);
});

test('writing again, as a retry does, is still one food', async () => {
  const db = phone();
  const added = foodsOn(db).add(bread());
  await added.write();
  await added.write();
  expect(await foods(db)).toHaveLength(1);
});

test('a product of Open Food Facts keeps its source, brand, barcode and nutrients', async () => {
  const db = phone();
  await foodsOn(db).add(coca()).write();
  expect(await foods(db)).toEqual([{ ref: { type: 'custom', id: expect.any(String) }, ...coca() }]);
});

test('editing such a food keeps what it came with', async () => {
  const db = phone();
  await foodsOn(db).add(coca()).write();
  const [created] = await foods(db);
  await foodsOn(db).update(created.ref.id, { ...coca(), name: 'Coca-Cola, canette' });
  expect(await foods(db)).toEqual([{ ...created, name: 'Coca-Cola, canette' }]);
});

test.each([
  ['a barcode that is not numeric', { barcode: 'abc12345' }],
  ['a barcode of 7 digits', { barcode: '1234567' }],
  ['a barcode of 15 digits', { barcode: '123456789012345' }],
  ['a source that is unknown', { source: 'usda' as never }],
  ['a nutrient that is not in the catalogue', { nutrients: { vitamin: 1 } as never }],
  ['a nutrient below zero', { nutrients: { iron: -1 } }],
])('the rules refuse %s', async (_, patch) => {
  await expect(foodsOn(phone()).add({ ...coca(), ...patch }).write()).rejects.toThrow();
});
