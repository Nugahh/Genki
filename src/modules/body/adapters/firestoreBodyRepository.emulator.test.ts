import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, setLogLevel, type Firestore } from 'firebase/firestore';
import { readFileSync } from 'node:fs';
import type { Measure } from '../domain/body';
import { firestoreBodyRepository } from './firestoreBodyRepository';

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
const bodyOn = (db: Firestore) => firestoreBodyRepository(db as never, 'alice');
const at = new Date('2026-11-03T10:00:00Z');

const recent = (db: Firestore, from: string, to: string) =>
  new Promise<Map<string, Measure>>((resolve, reject) => {
    const stop = bodyOn(db).observeRecent(from, to, (days) => {
      stop();
      resolve(days);
    }, reject);
  });

test('a measure is merged into the day, and the totals of the day are left alone', async () => {
  const db = phone();
  await setDoc(doc(db, 'users/alice/days/2026-11-03'), { kcal: 1800, waterMl: 1500, updatedAt: new Date() });
  await bodyOn(db).save('2026-11-03', { weightKg: 80.5 }, [], at);
  await bodyOn(db).save('2026-11-03', { waistCm: 92 }, [], at);
  const day = (await getDoc(doc(db, 'users/alice/days/2026-11-03'))).data();
  expect(day).toMatchObject({ kcal: 1800, waterMl: 1500, weightKg: 80.5, waistCm: 92 });
});

test('the recent measures come back for the days that have one, within the range', async () => {
  const db = phone();
  await bodyOn(db).save('2026-10-30', { weightKg: 81 }, [], at);
  await bodyOn(db).save('2026-11-03', { weightKg: 80, waistCm: 92 }, [], at);
  await bodyOn(db).save('2026-10-01', { weightKg: 90 }, [], at);
  await setDoc(doc(db, 'users/alice/days/2026-11-02'), { kcal: 1500, updatedAt: new Date() }); // a day with totals only
  const days = await recent(db, '2026-10-28', '2026-11-03');
  expect([...days]).toEqual([
    ['2026-10-30', { weightKg: 81 }],
    ['2026-11-03', { weightKg: 80, waistCm: 92 }],
  ]);
});

test('a measure sets the date of the milestones it reached, with the measure, once', async () => {
  const db = phone();
  const milestone = doc(db, 'users/alice/milestones/m1');
  await setDoc(milestone, { metric: 'waistCm', target: 90, direction: 'down', label: 'Tour de taille sous 90 cm' });
  await bodyOn(db).save('2026-11-03', { waistCm: 89 }, ['m1'], at);
  expect((await getDoc(milestone)).data()?.achievedAt.toDate()).toEqual(at);
  // The date is set once: a second measure naming the milestone is refused as a whole, measure included.
  await expect(bodyOn(db).save('2026-11-04', { waistCm: 88 }, ['m1'], at)).rejects.toThrow();
  expect((await recent(db, '2026-11-01', '2026-11-05')).has('2026-11-04')).toBe(false);
});

test('a measure out of range is refused', async () => {
  await expect(bodyOn(phone()).save('2026-11-03', { weightKg: 5 }, [], at)).rejects.toThrow();
});
