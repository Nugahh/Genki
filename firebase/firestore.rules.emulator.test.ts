import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  deleteDoc,
  doc,
  getDoc,
  increment,
  setDoc,
  setLogLevel,
  Timestamp,
  updateDoc,
  type Firestore,
} from 'firebase/firestore';
import { readFileSync } from 'node:fs';

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

// rules-unit-testing hands out compat instances; the modular functions accept them.
const db = (uid?: string) =>
  (uid ? env.authenticatedContext(uid) : env.unauthenticatedContext()).firestore() as unknown as Firestore;

const seed = (path: string, data: object) =>
  env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore() as unknown as Firestore, path), data));

const entry = () => ({ day: '2026-10-23', ml: 250, createdAt: Timestamp.now(), deletedAt: null });

describe('ownership', () => {
  test('the owner reads and writes their own data', async () => {
    await assertSucceeds(setDoc(doc(db('alice'), 'users/alice/waterEntries/e1'), entry()));
    await assertSucceeds(getDoc(doc(db('alice'), 'users/alice/waterEntries/e1')));
    await assertSucceeds(setDoc(doc(db('alice'), 'users/alice/waterEntries/e2'), { ...entry(), ml: 5000 }));
  });

  test('another user or a signed-out client gets nothing', async () => {
    await seed('users/alice/waterEntries/e1', entry());
    await assertFails(getDoc(doc(db('bob'), 'users/alice/waterEntries/e1')));
    await assertFails(getDoc(doc(db(), 'users/alice/waterEntries/e1')));
    await assertFails(setDoc(doc(db('bob'), 'users/alice/waterEntries/e2'), entry()));
    await assertFails(updateDoc(doc(db('bob'), 'users/alice/waterEntries/e1'), { deletedAt: Timestamp.now() }));
    await assertFails(
      setDoc(doc(db('bob'), 'users/alice/days/2026-10-23'), { waterMl: 250, updatedAt: Timestamp.now() }),
    );
  });

  test('documents without validation yet stay closed to writes', async () => {
    await assertFails(setDoc(doc(db('alice'), 'users/alice'), { timezone: 'Europe/Paris' }));
    await assertFails(setDoc(doc(db('alice'), 'users/alice/foods/f1'), { name: 'Riz' }));
  });
});

describe('waterEntries', () => {
  test.each<[string, object]>([
    ['ml is zero', { ml: 0 }],
    ['ml is above 5 000', { ml: 5001 }],
    ['ml is a string', { ml: '250' }],
    ['day is not YYYY-MM-DD', { day: '23/10/2026' }],
    ['createdAt is not a timestamp', { createdAt: 'now' }],
    ['deletedAt is already set', { deletedAt: Timestamp.now() }],
    ['an unknown field is present', { note: 'hi' }],
  ])('rejects an entry when %s', async (_, override) => {
    await assertFails(setDoc(doc(db('alice'), 'users/alice/waterEntries/e1'), { ...entry(), ...override }));
  });

  test('rejects an entry with a missing field', async () => {
    await assertFails(
      setDoc(doc(db('alice'), 'users/alice/waterEntries/e1'), { day: '2026-10-23', ml: 250, deletedAt: null }),
    );
  });

  test('an entry is soft-deleted once, and nothing else about it changes', async () => {
    await seed('users/alice/waterEntries/e1', entry());
    const ref = doc(db('alice'), 'users/alice/waterEntries/e1');
    await assertFails(updateDoc(ref, { ml: 500 }));
    await assertFails(updateDoc(ref, { ml: 500, deletedAt: Timestamp.now() }));
    await assertFails(deleteDoc(ref));
    await assertSucceeds(updateDoc(ref, { deletedAt: Timestamp.now() }));
    // A second delete would take the glass off the day total twice.
    await assertFails(updateDoc(ref, { deletedAt: Timestamp.now() }));
  });
});

describe('days', () => {
  test('accepts a water total moved by increment()', async () => {
    await assertSucceeds(
      setDoc(
        doc(db('alice'), 'users/alice/days/2026-10-23'),
        { waterMl: increment(250), updatedAt: Timestamp.now() },
        { merge: true },
      ),
    );
  });

  test.each<[string, object]>([
    ['the water total goes negative', { waterMl: -1, updatedAt: Timestamp.now() }],
    ['an unknown field is present', { waterMl: 250, updatedAt: Timestamp.now(), foo: 1 }],
    ['updatedAt is missing', { waterMl: 250 }],
  ])('rejects a day when %s', async (_, data) => {
    await assertFails(setDoc(doc(db('alice'), 'users/alice/days/2026-10-23'), data));
  });

  test('rejects a day id that is not a date', async () => {
    await assertFails(setDoc(doc(db('alice'), 'users/alice/days/today'), { waterMl: 250, updatedAt: Timestamp.now() }));
  });
});
