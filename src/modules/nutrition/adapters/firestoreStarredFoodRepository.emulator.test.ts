import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, setDoc, setLogLevel, Timestamp, type Firestore } from 'firebase/firestore';
import { readFileSync } from 'node:fs';
import type { StarredFood } from '../domain/food';
import { firestoreStarredFoodRepository } from './firestoreStarredFoodRepository';

// Denials here are expected: without this the SDK logs each one as a warning.
setLogLevel('error');

let env: RulesTestEnvironment;
beforeAll(async () => {
  env = await initializeTestEnvironment({ projectId: 'demo-genki', firestore: { rules: readFileSync('firebase/firestore.rules', 'utf8') } });
});
afterEach(() => env.clearFirestore());
afterAll(() => env.cleanup());

const phone = (uid = 'alice') => env.authenticatedContext(uid).firestore() as unknown as Firestore;
// The adapter is typed for React Native Firebase; here it runs on the web SDK (jest.emulator.config.js).
const starsOn = (db: Firestore, uid = 'alice') => firestoreStarredFoodRepository(db as never, uid);
const list = (db: Firestore) =>
  new Promise<StarredFood[]>((resolve, reject) => {
    const stop = starsOn(db).observeAll((stars) => {
      stop();
      resolve(stars);
    }, reject);
  });

const rice: StarredFood = { ref: { type: 'ciqual', id: '9100' }, name: 'Riz blanc, cru' };

test('a starred food is listed with its reference and its name', async () => {
  const db = phone();
  await starsOn(db).add(rice);
  expect(await list(db)).toEqual([rice]);
});

test('starring a food twice is one document', async () => {
  const db = phone();
  await starsOn(db).add(rice);
  await starsOn(db).add({ ...rice, name: 'Riz' });
  expect(await list(db)).toEqual([{ ...rice, name: 'Riz' }]);
});

test('a food of the user and a food of Ciqual with the same id are two stars', async () => {
  const db = phone();
  await starsOn(db).add({ ref: { type: 'ciqual', id: '1' }, name: 'A' });
  await starsOn(db).add({ ref: { type: 'custom', id: '1' }, name: 'B' });
  expect(await list(db)).toHaveLength(2);
});

test('removing the star takes the food out', async () => {
  const db = phone();
  await starsOn(db).add(rice);
  await starsOn(db).remove(rice.ref);
  expect(await list(db)).toEqual([]);
});

test('the rules refuse a name of more than 200 characters', async () => {
  await expect(starsOn(phone()).add({ ...rice, name: 'x'.repeat(201) })).rejects.toThrow();
});

test('the rules refuse a document that is not named after its food', async () => {
  const db = phone();
  await expect(setDoc(doc(db, 'users/alice/starredFoods/autre'), { foodRef: rice.ref, foodName: rice.name, updatedAt: Timestamp.now() })).rejects.toThrow();
  await expect(setDoc(doc(db, 'users/alice/starredFoods/ciqual_9100'), { foodRef: rice.ref, foodName: rice.name, updatedAt: Timestamp.now(), note: 'x' })).rejects.toThrow();
});

test('another user can neither star nor unstar in this account', async () => {
  await starsOn(phone()).add(rice);
  const bob = phone('bob');
  await expect(starsOn(bob, 'alice').add({ ...rice, name: 'Autre' })).rejects.toThrow();
  await expect(starsOn(bob, 'alice').remove(rice.ref)).rejects.toThrow();
  expect(await list(phone())).toEqual([rice]);
});
