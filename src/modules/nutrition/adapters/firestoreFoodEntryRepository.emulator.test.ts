import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { disableNetwork, doc, enableNetwork, getDocFromServer, setLogLevel, type Firestore } from 'firebase/firestore';
import { readFileSync } from 'node:fs';
import type { FoodEntry } from '../domain/food';
import { ZERO_MACROS, type Macros } from '../domain/macros';
import { firestoreFoodEntryRepository } from './firestoreFoodEntryRepository';

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
const entriesOn = (db: Firestore) => firestoreFoodEntryRepository(db as never, 'alice');

const rice = { kcal: 350, protein: 7, carbs: 78, fat: 0.6 };
const double = { kcal: 700, protein: 14, carbs: 156, fat: 1.2 };
const entry = (over = {}) => ({
  day: '2026-10-24', meal: 'lunch' as const, foodRef: { type: 'ciqual' as const, id: '9100' }, foodName: 'Riz blanc, cru',
  grams: 100, macros: rice, createdAt: new Date('2026-10-24T10:00:00Z'), ...over,
});

/** A change of quantity alone: the group, the day and the time stay. */
const same = (e: FoodEntry, grams: number, macros: Macros, nutrients?: FoodEntry['nutrients']) => ({ grams, meal: e.meal, day: e.day, createdAt: e.createdAt, macros, nutrients });
const dayDoc = async (db: Firestore) => (await getDocFromServer(doc(db, 'users/alice/days/2026-10-24'))).data();
// Day totals are sums of 0.1-rounded floats (0.6 + 1.2 is 1.7999999999999998): compare them within float noise.
const totalsOf = (m: Macros) => ({
  kcal: expect.closeTo(m.kcal), proteinG: expect.closeTo(m.protein), carbsG: expect.closeTo(m.carbs), fatG: expect.closeTo(m.fat),
});

const firstOf = (observe: (onNext: (entries: FoodEntry[]) => void, onError: (error: Error) => void) => () => void) =>
  new Promise<FoodEntry[]>((resolve, reject) => {
    const stop = observe((entries) => {
      stop();
      resolve(entries);
    }, reject);
  });
const journal = (db: Firestore) => firstOf((next, fail) => entriesOn(db).observeDay('2026-10-24', next, fail));
const recent = (db: Firestore, max: number) => firstOf((next, fail) => entriesOn(db).observeRecent(max, next, fail));

test('an added entry is listed on its day and its macros go onto the day total', async () => {
  const db = phone();
  await entriesOn(db).add(entry({ day: '2026-10-23' }));
  await entriesOn(db).add(entry());
  expect(await journal(db)).toEqual([{ id: expect.any(String), ...entry() }]);
  // Nutrition writes its own fields only: no waterMl.
  expect(await dayDoc(db)).toEqual({ ...totalsOf(rice), updatedAt: expect.anything() });
});

test('macros finer than 0.1 move the day total by their rounded value, on add and on remove alike', async () => {
  const db = phone();
  await entriesOn(db).add(entry({ macros: { kcal: 100.04, protein: 0.04, carbs: 0.06, fat: 0.14 } }));
  expect(await dayDoc(db)).toMatchObject(totalsOf({ kcal: 100, protein: 0, carbs: 0.1, fat: 0.1 }));
  const [added] = await journal(db);
  await entriesOn(db).remove(added);
  expect(await dayDoc(db)).toMatchObject(totalsOf(ZERO_MACROS));
});

test('two phones adding entries offline end up with the sum (spec §10)', async () => {
  const [a, b] = [phone(), phone()];
  await Promise.all([disableNetwork(a), disableNetwork(b)]);
  const writes = [entriesOn(a).add(entry()), entriesOn(b).add(entry({ grams: 200, macros: double }))];
  await Promise.all([enableNetwork(a), enableNetwork(b)]);
  await Promise.all(writes);
  expect(await dayDoc(a)).toMatchObject(totalsOf({ kcal: 1050, protein: 21, carbs: 234, fat: 1.8 }));
});

test('changing the quantity updates the entry and moves the day total by the difference', async () => {
  const db = phone();
  await entriesOn(db).add(entry({ grams: 200, macros: double }));
  const [added] = await journal(db);
  await entriesOn(db).update(added, same(added, 100, rice));
  expect(await journal(db)).toEqual([{ id: added.id, ...entry() }]);
  expect(await dayDoc(db)).toMatchObject(totalsOf(rice));
});

test('removing an entry hides it from the journal and the recents and takes it off the total', async () => {
  const db = phone();
  await entriesOn(db).add(entry());
  const [added] = await journal(db);
  await entriesOn(db).remove(added);
  expect(await journal(db)).toEqual([]);
  expect(await recent(db, 10)).toEqual([]);
  expect(await dayDoc(db)).toMatchObject(totalsOf(ZERO_MACROS));
});

test('an entry removed offline on two phones comes off the total once', async () => {
  const [a, b] = [phone(), phone()];
  // The 200 g entry keeps a double decrement above zero: only the delete-once rule can stop it.
  await entriesOn(a).add(entry({ grams: 200, macros: double }));
  await entriesOn(a).add(entry());
  const hundred = (await journal(a)).find((e) => e.grams === 100);
  await Promise.all([disableNetwork(a), disableNetwork(b)]);
  const removals = [entriesOn(a).remove(hundred!), entriesOn(b).remove(hundred!)];
  await Promise.all([enableNetwork(a), enableNetwork(b)]);
  const results = await Promise.allSettled(removals);
  expect(results.filter((r) => r.status === 'rejected')).toHaveLength(1);
  expect(await dayDoc(a)).toMatchObject(totalsOf(double));
});

test('an entry the rules refuse leaves the day total alone: one batch', async () => {
  const db = phone();
  await expect(entriesOn(db).add(entry({ grams: 6000 }))).rejects.toThrow();
  expect(await dayDoc(db)).toBeUndefined();
});

test('the latest entries come newest first, whatever the order they were added in', async () => {
  const db = phone();
  await entriesOn(db).add(entry({ foodName: 'Pâtes', createdAt: new Date('2026-10-24T11:00:00Z') }));
  await entriesOn(db).add(entry({ foodName: 'Pain', createdAt: new Date('2026-10-24T12:00:00Z') }));
  await entriesOn(db).add(entry({ foodName: 'Riz', createdAt: new Date('2026-10-24T10:00:00Z') }));
  expect((await recent(db, 2)).map((e) => e.foodName)).toEqual(['Pain', 'Pâtes']);
});

describe('nutrients', () => {
  const iron = { iron: 1.94, vitC: 0 };
  const between = (db: Firestore, from: string, to: string) => firstOf((next, fail) => entriesOn(db).observeRange(from, to, next, fail));

  test('an entry keeps the nutrients of its portion, and a change of quantity rewrites them', async () => {
    const db = phone();
    await entriesOn(db).add(entry({ nutrients: iron }));
    const [added] = await journal(db);
    expect(added.nutrients).toEqual(iron);
    await entriesOn(db).update(added, same(added, 200, double, { iron: 3.88, vitC: 0 }));
    expect((await journal(db))[0]).toMatchObject({ grams: 200, nutrients: { iron: 3.88, vitC: 0 } });
  });

  test('an entry without nutrients is added, read and rescaled without a nutrients field', async () => {
    const db = phone();
    await entriesOn(db).add(entry());
    const [added] = await journal(db);
    expect(added.nutrients).toBeUndefined();
    await entriesOn(db).update(added, same(added, 200, double));
    expect((await journal(db))[0].nutrients).toBeUndefined();
  });

  test('the range lists the live entries of the days from one date to the other, both included', async () => {
    const db = phone();
    for (const day of ['2026-10-22', '2026-10-23', '2026-10-24', '2026-10-25']) await entriesOn(db).add(entry({ day, foodName: day }));
    const [gone] = (await between(db, '2026-10-24', '2026-10-24'));
    await entriesOn(db).remove(gone);
    expect((await between(db, '2026-10-23', '2026-10-25')).map((e) => e.foodName).sort()).toEqual(['2026-10-23', '2026-10-25']);
  });
});

describe('changing the group and the time', () => {
  const dayDocOf = async (db: Firestore, day: string) => (await getDocFromServer(doc(db, `users/alice/days/${day}`))).data();

  test('a new group on the same day moves nothing but the difference of the totals', async () => {
    const db = phone();
    await entriesOn(db).add(entry());
    const [added] = await journal(db);
    await entriesOn(db).update(added, { ...same(added, 100, rice), meal: 'dinner' });
    expect((await journal(db))[0]).toMatchObject({ meal: 'dinner' });
    expect(await dayDoc(db)).toMatchObject(totalsOf(rice));
  });

  test('a new day takes the old macros off the old day and puts the new ones on the new day, in one write', async () => {
    const db = phone();
    await entriesOn(db).add(entry());
    const [added] = await journal(db);
    const at = new Date('2026-10-23T18:00:00Z');
    await entriesOn(db).update(added, { grams: 200, meal: 'dinner', day: '2026-10-23', createdAt: at, macros: double });
    expect(await dayDoc(db)).toMatchObject(totalsOf(ZERO_MACROS));
    expect(await dayDocOf(db, '2026-10-23')).toMatchObject(totalsOf(double));
    expect(await journal(db)).toEqual([]);
    expect((await firstOf((next, fail) => entriesOn(db).observeDay('2026-10-23', next, fail)))[0]).toMatchObject({ grams: 200, meal: 'dinner', createdAt: at });
  });

  test('an update the rules refuse moves neither total', async () => {
    const db = phone();
    await entriesOn(db).add(entry());
    const [added] = await journal(db);
    await expect(entriesOn(db).update(added, { ...same(added, 100, rice), day: 'hier' })).rejects.toThrow();
    expect(await dayDoc(db)).toMatchObject(totalsOf(rice));
    expect(await dayDocOf(db, 'hier')).toBeUndefined();
    expect((await journal(db))[0].day).toBe('2026-10-24');
  });
});
