import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { disableNetwork, doc, enableNetwork, getDocFromServer, setLogLevel, type Firestore } from 'firebase/firestore';
import { readFileSync } from 'node:fs';
import type { WaterEntry } from '../application/ports';
import { firestoreWaterRepository } from './firestoreWaterRepository';

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
  const writes = [waterOn(a).add(glass(250)).saved, waterOn(b).add(glass(500)).saved];
  await Promise.all([enableNetwork(a), enableNetwork(b)]);
  await Promise.all(writes);
  expect(await serverTotal(a)).toBe(750);
});

test('add hands back the id the glass is stored under, before the server has it', async () => {
  const db = phone();
  await disableNetwork(db);
  const { id, saved } = waterOn(db).add(glass(250));
  // Offline, the glass is already in the journal under that id, so it can be taken back at once (the writes settle with the network).
  expect(await journal(db)).toEqual([{ id, ...glass(250) }]);
  const removed = waterOn(db).remove({ id, ...glass(250) });
  expect(await journal(db)).toEqual([]);
  await enableNetwork(db);
  await Promise.all([saved, removed]);
  expect(await serverTotal(db)).toBe(0);
});

test('removing a glass hides it from the journal and takes it off the total', async () => {
  const db = phone();
  await waterOn(db).add(glass(250)).saved;
  await waterOn(db).add(glass(500)).saved;
  const quarter = (await journal(db)).find((e) => e.ml === 250);
  await waterOn(db).remove(quarter!);
  expect(await journal(db)).toEqual([{ id: expect.any(String), ...glass(500) }]);
  expect(await serverTotal(db)).toBe(500);
});

test('a glass the rules refuse leaves the total alone: one batch', async () => {
  const db = phone();
  await expect(waterOn(db).add(glass(6000)).saved).rejects.toThrow();
  expect(await serverTotal(db)).toBeUndefined();
});

test('a glass removed offline on two phones comes off the total once', async () => {
  const [a, b] = [phone(), phone()];
  // The 500 ml glass keeps a double decrement above zero: only the delete-once rule can stop it.
  await waterOn(a).add(glass(500)).saved;
  await waterOn(a).add(glass(250)).saved;
  const quarter = (await journal(a)).find((e) => e.ml === 250);
  await Promise.all([disableNetwork(a), disableNetwork(b)]);
  const removals = [waterOn(a).remove(quarter!), waterOn(b).remove(quarter!)];
  await Promise.all([enableNetwork(a), enableNetwork(b)]);
  const results = await Promise.allSettled(removals);
  expect(results.filter((r) => r.status === 'rejected')).toHaveLength(1);
  expect(await serverTotal(a)).toBe(500);
});
