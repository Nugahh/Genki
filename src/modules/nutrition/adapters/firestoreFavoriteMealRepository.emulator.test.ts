import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { setLogLevel, type Firestore } from 'firebase/firestore';
import { readFileSync } from 'node:fs';
import type { FavoriteMeal } from '../domain/food';
import { firestoreFavoriteMealRepository } from './firestoreFavoriteMealRepository';

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
const mealsOn = (db: Firestore) => firestoreFavoriteMealRepository(db as never, 'alice');

const lunch = () => ({
  name: 'Déjeuner habituel',
  items: [{ foodRef: { type: 'ciqual' as const, id: '9100' }, foodName: 'Riz blanc, cru', grams: 150 }],
});

const favorites = (db: Firestore) =>
  new Promise<FavoriteMeal[]>((resolve, reject) => {
    const stop = mealsOn(db).observeAll((list) => {
      stop();
      resolve(list);
    }, reject);
  });

test('a created favorite is listed with a generated id, its name and its items', async () => {
  const db = phone();
  await mealsOn(db).create(lunch());
  expect(await favorites(db)).toEqual([{ id: expect.any(String), ...lunch() }]);
});

test('a removed favorite leaves the list', async () => {
  const db = phone();
  await mealsOn(db).create(lunch());
  const [created] = await favorites(db);
  await mealsOn(db).remove(created.id);
  expect(await favorites(db)).toEqual([]);
});

test('a favorite without items is rejected', async () => {
  await expect(mealsOn(phone()).create({ name: 'Vide', items: [] })).rejects.toThrow();
});
