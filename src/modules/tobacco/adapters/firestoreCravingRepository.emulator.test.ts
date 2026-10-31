import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, setDoc, setLogLevel, Timestamp, type Firestore } from 'firebase/firestore';
import { readFileSync } from 'node:fs';
import type { Craving } from '../domain/tobacco';
import { firestoreCravingRepository } from './firestoreCravingRepository';

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

const phone = (uid = 'alice') => env.authenticatedContext(uid).firestore() as unknown as Firestore;
const cravingsOn = (db: Firestore) => firestoreCravingRepository(db as never, 'alice');
const craving = (day: string, resisted = true) => ({ day, createdAt: new Date(`${day}T10:00:00Z`), resisted });

const between = (db: Firestore, from: string, to: string) =>
  new Promise<Craving[]>((resolve, reject) => {
    const stop = cravingsOn(db).observeBetween(from, to, (list) => {
      stop();
      resolve(list);
    }, reject);
  });

test('a craving is noted with an id, and comes back with its day, time and outcome', async () => {
  const db = phone();
  const { id, saved } = cravingsOn(db).add(craving('2026-10-11', false));
  await saved;
  expect(await between(db, '2026-10-11', '2026-10-11')).toEqual([{ id, ...craving('2026-10-11', false) }]);
});

test('the cravings between two days are read, both days included', async () => {
  const db = phone();
  for (const day of ['2026-10-09', '2026-10-10', '2026-10-12', '2026-10-13']) await cravingsOn(db).add(craving(day)).saved;
  expect((await between(db, '2026-10-10', '2026-10-12')).map((c) => c.day).sort()).toEqual(['2026-10-10', '2026-10-12']);
});

test('a craving can be taken back', async () => {
  const db = phone();
  const { id, saved } = cravingsOn(db).add(craving('2026-10-11'));
  await saved;
  await cravingsOn(db).remove(id);
  expect(await between(db, '2026-10-11', '2026-10-11')).toEqual([]);
});

test('a craving with a field too many, a day that is not a day, or another user, is refused', async () => {
  const db = phone();
  const data = { day: '2026-10-11', createdAt: Timestamp.now(), resisted: true };
  await expect(setDoc(doc(db, 'users/alice/cravings/c1'), { ...data, note: 'x' })).rejects.toThrow();
  await expect(setDoc(doc(db, 'users/alice/cravings/c1'), { ...data, day: 'hier' })).rejects.toThrow();
  await expect(setDoc(doc(db, 'users/alice/cravings/c1'), { ...data, resisted: 'oui' })).rejects.toThrow();
  await expect(setDoc(doc(phone('bob'), 'users/alice/cravings/c1'), data)).rejects.toThrow();
});
