import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { disableNetwork, doc, enableNetwork, serverTimestamp, setDoc, Timestamp, type Firestore } from 'firebase/firestore';
import { readFileSync } from 'node:fs';
import type { DayTotals } from '../application/ports';
import type { SyncMeta } from '../domain/sync';
import { firestoreDayTotals } from './firestoreDayTotals';

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

/** Resolves with the totals of the first snapshot of today that matches. */
const totalsUntil = (db: Firestore, matches: (waterMl: number, sync: SyncMeta) => boolean) =>
  new Promise<DayTotals>((resolve, reject) => {
    // The adapter is typed for React Native Firebase; here it runs on the web SDK (jest.emulator.config.js).
    const stop = firestoreDayTotals(db as never, 'alice').observe(
      '2026-10-23',
      (totals, sync) => {
        if (!matches(totals.waterMl, sync)) return;
        stop();
        resolve(totals);
      },
      reject,
    );
  });

test('a day without data reads as zero once the server answered', async () => {
  await totalsUntil(phone(), (waterMl, sync) => waterMl === 0 && !sync.fromCache);
});

test('a write is pending offline, then synced once the server has it', async () => {
  const db = phone();
  await disableNetwork(db);
  const pending = totalsUntil(db, (waterMl, sync) => waterMl === 250 && sync.hasPendingWrites);
  const write = setDoc(doc(db, 'users/alice/days/2026-10-23'), { waterMl: 250, updatedAt: serverTimestamp() });
  await pending;
  await enableNetwork(db);
  await write;
  await totalsUntil(db, (waterMl, sync) => waterMl === 250 && !sync.hasPendingWrites && !sync.fromCache);
});

test('reads the nutrition totals, a missing field as zero and a slight negative drift as zero', async () => {
  const db = phone();
  const day = doc(db, 'users/alice/days/2026-10-23');
  await setDoc(day, { kcal: 1200.4, proteinG: 80, carbsG: 130, fatG: 40, updatedAt: serverTimestamp() });
  expect(await totalsUntil(db, (_, sync) => !sync.fromCache)).toEqual({ waterMl: 0, kcal: 1200.4, proteinG: 80, carbsG: 130, fatG: 40, steps: 0 });
  await setDoc(day, { kcal: -0.03, updatedAt: serverTimestamp() });
  expect(await totalsUntil(db, (_, sync) => !sync.fromCache)).toEqual({ waterMl: 0, kcal: 0, proteinG: 0, carbsG: 0, fatG: 0, steps: 0 });
});

test('reads the steps with where they come from and when they were read', async () => {
  const db = phone();
  await setDoc(doc(db, 'users/alice/days/2026-10-23'), { steps: 8342, stepsSource: 'fitbit', stepsSyncedAt: Timestamp.fromDate(new Date('2026-10-23T14:32:00Z')), updatedAt: serverTimestamp() });
  const totals = await totalsUntil(db, (_, sync) => !sync.fromCache);
  expect(totals).toMatchObject({ steps: 8342, stepsSource: 'fitbit', stepsSyncedAt: new Date('2026-10-23T14:32:00Z') });
});
