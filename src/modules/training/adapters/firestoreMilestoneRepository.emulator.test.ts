import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { setLogLevel, type Firestore } from 'firebase/firestore';
import { readFileSync } from 'node:fs';
import type { Milestone } from '../domain/milestone';
import { firestoreMilestoneRepository } from './firestoreMilestoneRepository';

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

const milestonesOn = (db: Firestore) => firestoreMilestoneRepository(db as never, 'alice');
const pullups = { metric: 'exercise:tractions:reps', target: 10, direction: 'up' as const, label: '10 tractions' };

const observed = (db: Firestore) =>
  new Promise<Milestone[]>((resolve, reject) => {
    const stop = milestonesOn(db).observeAll((list) => {
      stop();
      resolve(list);
    }, reject);
  });

test('a created milestone is listed and observed with a generated id, not achieved', async () => {
  const db = phone();
  await milestonesOn(db).create(pullups);
  expect(await milestonesOn(db).list()).toEqual([{ id: expect.any(String), ...pullups }]);
  expect(await observed(db)).toEqual([{ id: expect.any(String), ...pullups }]);
});

test('a removed milestone leaves the list', async () => {
  const db = phone();
  await milestonesOn(db).create(pullups);
  const [created] = await milestonesOn(db).list();
  await milestonesOn(db).remove(created.id);
  expect(await milestonesOn(db).list()).toEqual([]);
});

test('a milestone with a target out of range is refused', async () => {
  await expect(milestonesOn(phone()).create({ ...pullups, target: -1 })).rejects.toThrow();
});
