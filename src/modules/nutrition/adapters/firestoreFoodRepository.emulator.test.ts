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
  await foodsOn(db).create(bread());
  expect(await foods(db)).toEqual([{ ref: { type: 'custom', id: expect.any(String) }, ...bread() }]);
});

test('updating a food changes it in the list', async () => {
  const db = phone();
  await foodsOn(db).create(bread());
  const [created] = await foods(db);
  await foodsOn(db).update(created.ref.id, { ...bread(), name: 'Pain de mie' });
  expect(await foods(db)).toEqual([{ ...created, name: 'Pain de mie' }]);
});

test('a removed food leaves the list', async () => {
  const db = phone();
  await foodsOn(db).create(bread());
  const [created] = await foods(db);
  await foodsOn(db).remove(created.ref.id);
  expect(await foods(db)).toEqual([]);
});

test('a food the rules refuse is rejected', async () => {
  await expect(foodsOn(phone()).create({ ...bread(), per100g: { kcal: 1000, protein: 8, carbs: 48, fat: 2 } })).rejects.toThrow();
});
