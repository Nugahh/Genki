import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, setDoc, setLogLevel, type Firestore } from 'firebase/firestore';
import { readFileSync } from 'node:fs';
import type { DayFacts } from '../domain/metric';
import { firestoreDaysSource } from './firestoreDaysSource';

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

// Steps, weight and waist are written by M5 and M6: the rules do not allow them yet, so the days are seeded around the rules.
const seed = (day: string, data: object) => env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore() as unknown as Firestore, `users/alice/days/${day}`), data));

const range = (from: string, to: string, uid = 'alice') =>
  new Promise<Map<string, DayFacts>>((resolve, reject) => {
    const db = env.authenticatedContext(uid).firestore() as unknown as Firestore;
    const stop = firestoreDaysSource(db as never, 'alice').observeRange(from, to, (facts) => {
      stop();
      resolve(facts);
    }, reject);
  });

test('reads the days between two days, both included, with the facts they hold', async () => {
  await seed('2026-10-31', { kcal: 9999 }); // before the range
  await seed('2026-11-01', { kcal: 1800, proteinG: 90, carbsG: 200, fatG: 60, waterMl: 2000, steps: 7500, weightKg: 80.5, waistCm: 90 });
  await seed('2026-11-08', { kcal: 2100 });
  await seed('2026-11-09', { kcal: 9999 }); // after the range
  const facts = await range('2026-11-01', '2026-11-08');
  expect([...facts.keys()]).toEqual(['2026-11-01', '2026-11-08']);
  expect(facts.get('2026-11-01')).toEqual({ kcal: 1800, proteinG: 90, carbsG: 200, fatG: 60, waterMl: 2000, steps: 7500, weightKg: 80.5, waistCm: 90 });
  expect(facts.get('2026-11-08')).toMatchObject({ kcal: 2100, proteinG: undefined });
});

test('a total back at 0 is a day with no record, and a field that is not a number is ignored', async () => {
  await seed('2026-11-02', { kcal: 0, waterMl: 'lots', weightKg: 79 });
  expect((await range('2026-11-01', '2026-11-08')).get('2026-11-02')).toMatchObject({ kcal: undefined, waterMl: undefined, weightKg: 79 });
});

test('another user cannot read the days', async () => {
  await seed('2026-11-02', { kcal: 100 });
  await expect(range('2026-11-01', '2026-11-08', 'bob')).rejects.toThrow();
});
