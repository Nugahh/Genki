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
    await assertFails(setDoc(doc(db('alice'), 'users/alice/workoutLogs/w1'), { name: 'Séance' }));
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

const macros = { kcal: 350, protein: 7, carbs: 78, fat: 0.6 };
const foodEntry = () => ({
  day: '2026-10-24', meal: 'lunch', foodRef: { type: 'ciqual', id: '9100' }, foodName: 'Riz blanc, cru',
  grams: 100, macros, createdAt: Timestamp.now(), updatedAt: Timestamp.now(), deletedAt: null,
});
const customFood = () => ({
  name: 'Pain maison', state: 'other', per100g: { kcal: 250, protein: 8, carbs: 48, fat: 2 },
  portions: [{ label: '1 tranche', grams: 30 }], updatedAt: Timestamp.now(), deletedAt: null,
});

describe('foodEntries', () => {
  test('the owner creates a sound entry, another user cannot', async () => {
    await assertSucceeds(setDoc(doc(db('alice'), 'users/alice/foodEntries/e1'), foodEntry()));
    await assertFails(setDoc(doc(db('bob'), 'users/alice/foodEntries/e2'), foodEntry()));
  });

  test.each<[string, object]>([
    ['grams is 0', { grams: 0 }],
    ['grams is above 5 000', { grams: 5001 }],
    ['the meal is unknown', { meal: 'brunch' }],
    ['the day is not a date', { day: 'hier' }],
    ['the food reference type is unknown', { foodRef: { type: 'usda', id: '1' } }],
    ['the food name is empty', { foodName: '' }],
    ['a macro is negative', { macros: { ...macros, fat: -1 } }],
    ['a macro is missing', { macros: { kcal: 1, protein: 1, carbs: 1 } }],
    ['deletedAt is already set', { deletedAt: Timestamp.now() }],
    ['an unknown field is present', { note: 'x' }],
  ])('rejects an entry when %s', async (_, override) => {
    await assertFails(setDoc(doc(db('alice'), 'users/alice/foodEntries/e1'), { ...foodEntry(), ...override }));
  });

  test('the quantity can change but nothing else, and the entry is soft-deleted once', async () => {
    await seed('users/alice/foodEntries/e1', foodEntry());
    const ref = doc(db('alice'), 'users/alice/foodEntries/e1');
    await assertFails(updateDoc(ref, { foodName: 'Autre' }));
    await assertFails(updateDoc(ref, { grams: 0, macros, updatedAt: Timestamp.now() }));
    await assertFails(updateDoc(ref, { grams: 200, macros, updatedAt: Timestamp.now(), meal: 'dinner' }));
    await assertSucceeds(updateDoc(ref, { grams: 200, macros: { ...macros, kcal: 700 }, updatedAt: Timestamp.now() }));
    await assertFails(deleteDoc(ref));
    await assertSucceeds(updateDoc(ref, { deletedAt: Timestamp.now() }));
    await assertFails(updateDoc(ref, { deletedAt: Timestamp.now() }));
    await assertFails(updateDoc(ref, { grams: 100, macros, updatedAt: Timestamp.now() }));
  });

  test('another user cannot update an entry', async () => {
    await seed('users/alice/foodEntries/e1', foodEntry());
    await assertFails(updateDoc(doc(db('bob'), 'users/alice/foodEntries/e1'), { deletedAt: Timestamp.now() }));
  });
});

describe('foods', () => {
  test('the owner creates, edits and soft-deletes a custom food', async () => {
    await assertSucceeds(setDoc(doc(db('alice'), 'users/alice/foods/f1'), customFood()));
    const ref = doc(db('alice'), 'users/alice/foods/f1');
    await assertSucceeds(updateDoc(ref, { name: 'Pain de mie', updatedAt: Timestamp.now() }));
    await assertFails(updateDoc(ref, { deletedAt: null, name: 'x', updatedAt: Timestamp.now(), foo: 1 }));
    await assertSucceeds(updateDoc(ref, { deletedAt: Timestamp.now() }));
    await assertFails(updateDoc(ref, { name: 'Trop tard', updatedAt: Timestamp.now() }));
    await assertFails(deleteDoc(ref));
  });

  test.each<[string, object]>([
    ['the name is empty', { name: '' }],
    ['the state is unknown', { state: 'frozen' }],
    ['kcal per 100 g is above 900', { per100g: { kcal: 901, protein: 0, carbs: 0, fat: 0 } }],
    ['a macro per 100 g is above 100', { per100g: { kcal: 400, protein: 101, carbs: 0, fat: 0 } }],
    ['there are 21 portions', { portions: Array.from({ length: 21 }, () => ({ label: 'p', grams: 1 })) }],
    ['portions is not a list', { portions: 'une' }],
  ])('rejects a food when %s', async (_, override) => {
    await assertFails(setDoc(doc(db('alice'), 'users/alice/foods/f1'), { ...customFood(), ...override }));
  });

  test('another user cannot write', async () => {
    await assertFails(setDoc(doc(db('bob'), 'users/alice/foods/f1'), customFood()));
  });
});

describe('favoriteMeals', () => {
  const favorite = () => ({
    name: 'Déjeuner habituel', items: [{ foodRef: { type: 'ciqual', id: '9100' }, foodName: 'Riz blanc, cru', grams: 150 }], updatedAt: Timestamp.now(),
  });

  test('the owner creates, edits and deletes a favorite', async () => {
    const ref = doc(db('alice'), 'users/alice/favoriteMeals/m1');
    await assertSucceeds(setDoc(ref, favorite()));
    await assertSucceeds(setDoc(ref, { ...favorite(), name: 'Autre nom' }));
    await assertSucceeds(deleteDoc(ref));
  });

  test.each<[string, object]>([
    ['the name is empty', { name: '' }],
    ['there are no items', { items: [] }],
    ['there are 51 items', { items: Array.from({ length: 51 }, () => ({ foodRef: { type: 'ciqual', id: '1' }, foodName: 'x', grams: 1 })) }],
    ['an unknown field is present', { note: 'x' }],
  ])('rejects a favorite when %s', async (_, override) => {
    await assertFails(setDoc(doc(db('alice'), 'users/alice/favoriteMeals/m1'), { ...favorite(), ...override }));
  });

  test('another user cannot delete', async () => {
    await seed('users/alice/favoriteMeals/m1', favorite());
    await assertFails(deleteDoc(doc(db('bob'), 'users/alice/favoriteMeals/m1')));
  });
});

describe('days (nutrition totals)', () => {
  test('accepts macro totals moved by increment(), with or without water', async () => {
    await assertSucceeds(setDoc(doc(db('alice'), 'users/alice/days/2026-10-24'), { kcal: increment(350), proteinG: increment(7), carbsG: increment(78), fatG: increment(0.6), updatedAt: Timestamp.now() }, { merge: true }));
    await assertSucceeds(setDoc(doc(db('alice'), 'users/alice/days/2026-10-25'), { waterMl: increment(250), updatedAt: Timestamp.now() }, { merge: true }));
  });

  test('tolerates a drift of 0.01 below zero on macros but rejects 0.1, and never on water', async () => {
    await assertSucceeds(setDoc(doc(db('alice'), 'users/alice/days/2026-10-24'), { kcal: -0.01, updatedAt: Timestamp.now() }));
    await assertFails(setDoc(doc(db('alice'), 'users/alice/days/2026-10-24'), { kcal: -0.1, updatedAt: Timestamp.now() }));
    await assertFails(setDoc(doc(db('alice'), 'users/alice/days/2026-10-24'), { waterMl: -0.01, updatedAt: Timestamp.now() }));
  });

  test('rejects a total that is not a number', async () => {
    await assertFails(setDoc(doc(db('alice'), 'users/alice/days/2026-10-24'), { proteinG: '12', updatedAt: Timestamp.now() }));
  });
});
