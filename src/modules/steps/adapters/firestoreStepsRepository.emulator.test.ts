import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, setLogLevel, Timestamp, type Firestore } from 'firebase/firestore';
import { readFileSync } from 'node:fs';
import type { Device } from '../application/ports';
import { firestoreStepsRepository } from './firestoreStepsRepository';

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
const stepsOn = (db: Firestore) => firestoreStepsRepository(db as never, 'alice');
const at = new Date('2026-11-03T10:00:00Z');

const devices = (db: Firestore) =>
  new Promise<{ devices: Device[]; known: boolean }>((resolve, reject) => {
    const stop = stepsOn(db).observeDevices((list, known) => {
      stop();
      resolve({ devices: list, known });
    }, reject);
  });

test('the steps are merged into the day with their source and the time, and the totals are left alone', async () => {
  const db = phone();
  await setDoc(doc(db, 'users/alice/days/2026-11-03'), { kcal: 1800, updatedAt: Timestamp.now() });
  await stepsOn(db).saveDay('2026-11-03', { steps: 8342, source: 'fitbit', syncedAt: at });
  const day = (await getDoc(doc(db, 'users/alice/days/2026-11-03'))).data();
  expect(day).toMatchObject({ kcal: 1800, steps: 8342, stepsSource: 'fitbit' });
  expect(day?.stepsSyncedAt.toDate()).toEqual(at);
});

test('steps out of range are refused', async () => {
  await expect(stepsOn(phone()).saveDay('2026-11-03', { steps: -5, source: 'phone', syncedAt: at })).rejects.toThrow();
});

test('a device is noted without a role, then made the writer, and the others stop in the same batch', async () => {
  const db = phone();
  await stepsOn(db).setWriter('b', 'Galaxy', []);
  await stepsOn(db).touchDevice('a', 'Pixel');
  expect((await devices(db)).devices.map((d) => [d.id, d.stepsWriter]).sort()).toEqual([['a', false], ['b', true]]);

  await stepsOn(db).setWriter('a', 'Pixel', ['b']);
  const { devices: after, known } = await devices(db);
  expect(known).toBe(true);
  expect(after.map((d) => [d.id, d.name, d.stepsWriter]).sort()).toEqual([['a', 'Pixel', true], ['b', 'Galaxy', false]]);
});

test('the time of the last sync is noted and read back', async () => {
  const db = phone();
  await stepsOn(db).touchDevice('a', 'Pixel', at);
  expect((await devices(db)).devices[0].lastStepsSyncAt).toEqual(at);
});

test('with no device at all the list is empty and, from the server, known', async () => {
  expect(await devices(phone())).toEqual({ devices: [], known: true });
});
