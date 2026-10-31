import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { setLogLevel, type Firestore } from 'firebase/firestore';
import { readFileSync } from 'node:fs';
import type { Plan } from '../domain/plan';
import { starterPlan } from '../domain/template';
import { firestorePlanRepository } from './firestorePlanRepository';

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

// Each authenticated context is a separate client: a phone.
const phone = () => env.authenticatedContext('alice').firestore() as unknown as Firestore;

// The adapter is typed for React Native Firebase; here it runs on the web SDK (jest.emulator.config.js).
const plansOn = (db: Firestore) => firestorePlanRepository(db as never, 'alice');

const plans = (db: Firestore) =>
  new Promise<Plan[]>((resolve, reject) => {
    const stop = plansOn(db).observeAll((list) => {
      stop();
      resolve(list);
    }, reject);
  });

test('a created programme is listed with a generated id and its whole content', async () => {
  const db = phone();
  await plansOn(db).create(starterPlan('2026-11-02'));
  expect(await plans(db)).toEqual([{ id: expect.any(String), ...starterPlan('2026-11-02') }]);
});

test('an updated programme keeps its id and takes the new content', async () => {
  const db = phone();
  await plansOn(db).create(starterPlan('2026-11-02'));
  const [created] = await plans(db);
  await plansOn(db).update({ ...created, name: 'Autre nom', startDay: '2026-12-01' });
  expect(await plans(db)).toEqual([{ ...created, name: 'Autre nom', startDay: '2026-12-01' }]);
});

test('a programme with no phase is refused', async () => {
  await expect(plansOn(phone()).create({ ...starterPlan('2026-11-02'), phases: [] })).rejects.toThrow();
});
