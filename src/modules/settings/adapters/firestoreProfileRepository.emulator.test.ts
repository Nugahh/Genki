import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { setLogLevel, type Firestore } from 'firebase/firestore';
import { readFileSync } from 'node:fs';
import type { UiPrefs } from '../domain/ui';
import { firestoreProfileRepository } from './firestoreProfileRepository';

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
const profileOn = (db: Firestore) => firestoreProfileRepository(db as never, 'alice');

const observed = (db: Firestore) =>
  new Promise<UiPrefs>((resolve, reject) => {
    const stop = profileOn(db).observeUi((ui) => {
      stop();
      resolve(ui);
    }, reject);
  });

test('nothing is chosen until something is saved', async () => {
  expect(await observed(phone())).toEqual({});
});

test('saved preferences are merged, so a period change keeps the statistics', async () => {
  const db = phone();
  await profileOn(db).saveUi({ hubMetrics: ['calories', 'water'], period: 'week' });
  await profileOn(db).saveUi({ period: 'year' });
  expect(await observed(db)).toEqual({ hubMetrics: ['calories', 'water'], period: 'year' });
});

test('a second phone sees what the first saved', async () => {
  await profileOn(phone()).saveUi({ hubMetrics: ['steps'] });
  expect(await observed(phone())).toEqual({ hubMetrics: ['steps'] });
});

test('preferences the rules refuse are rejected', async () => {
  await expect(profileOn(phone()).saveUi({ period: 'month' as never })).rejects.toThrow();
});
