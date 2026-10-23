import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { disableNetwork, doc, enableNetwork, serverTimestamp, setDoc, type Firestore } from 'firebase/firestore';
import { readFileSync } from 'node:fs';
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

/** Resolves on the first snapshot of today's totals that matches. */
const totalsUntil = (db: Firestore, matches: (waterMl: number, sync: SyncMeta) => boolean) =>
  new Promise<void>((resolve, reject) => {
    // The adapter is typed for React Native Firebase; here it runs on the web SDK (jest.emulator.config.js).
    const stop = firestoreDayTotals(db as never, 'alice').observe(
      '2026-10-23',
      (totals, sync) => {
        if (!matches(totals.waterMl, sync)) return;
        stop();
        resolve();
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
