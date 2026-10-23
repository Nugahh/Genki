import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { disableNetwork, doc, enableNetwork, getDocFromServer, type Firestore } from 'firebase/firestore';
import { readFileSync } from 'node:fs';
import type { WaterEntry } from '../application/ports';
import { firestoreWaterRepository } from './firestoreWaterRepository';

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
const waterOn = (db: Firestore) => firestoreWaterRepository(db as never, 'alice');
const glass = (ml: number) => ({ day: '2026-10-23', ml, createdAt: new Date('2026-10-23T10:00:00Z') });

const serverTotal = async (db: Firestore) =>
  (await getDocFromServer(doc(db, 'users/alice/days/2026-10-23'))).data()?.waterMl;

const journal = (db: Firestore) =>
  new Promise<WaterEntry[]>((resolve, reject) => {
    const stop = waterOn(db).observeDay(
      '2026-10-23',
      (entries) => {
        stop();
        resolve(entries);
      },
      reject,
    );
  });

test('two phones adding water offline end up with the sum (spec §10)', async () => {
  const [a, b] = [phone(), phone()];
  await Promise.all([disableNetwork(a), disableNetwork(b)]);
  const writes = [waterOn(a).add(glass(250)), waterOn(b).add(glass(500))];
  await Promise.all([enableNetwork(a), enableNetwork(b)]);
  await Promise.all(writes);
  expect(await serverTotal(a)).toBe(750);
});

test('removing a glass hides it from the journal and takes it off the total', async () => {
  const db = phone();
  await waterOn(db).add(glass(250));
  await waterOn(db).add(glass(500));
  const quarter = (await journal(db)).find((e) => e.ml === 250);
  await waterOn(db).remove(quarter!);
  expect((await journal(db)).map((e) => e.ml)).toEqual([500]);
  expect(await serverTotal(db)).toBe(500);
});

test('a glass removed offline on two phones comes off the total once', async () => {
  const [a, b] = [phone(), phone()];
  await waterOn(a).add(glass(250));
  const [entry] = await journal(a);
  await Promise.all([disableNetwork(a), disableNetwork(b)]);
  const removals = [waterOn(a).remove(entry), waterOn(b).remove(entry)];
  await Promise.all([enableNetwork(a), enableNetwork(b)]);
  const results = await Promise.allSettled(removals);
  expect(results.filter((r) => r.status === 'rejected')).toHaveLength(1);
  expect(await serverTotal(a)).toBe(0);
});
