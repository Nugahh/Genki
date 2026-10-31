import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, setLogLevel, Timestamp, type Firestore } from 'firebase/firestore';
import { readFileSync } from 'node:fs';
import { dataUseCases } from '../application/dataUseCases';
import { firestoreDataStore } from './firestoreDataStore';

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

const clock = { now: () => new Date('2026-11-03T10:00:00Z') };
const phone = () => env.authenticatedContext('alice').firestore() as unknown as Firestore;
const dataOn = (db: Firestore) => dataUseCases({ store: firestoreDataStore(db as never, 'alice'), clock, timezone: 'Europe/Paris' });
const at = (iso: string) => Timestamp.fromDate(new Date(iso));

/** An account as the app leaves it: one document of each collection, in the shapes the rules accept, and a glass taken back. */
async function seedAccount() {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore() as unknown as Firestore;
    const put = (path: string, data: object) => setDoc(doc(db, path), data);
    const macros = { kcal: 350, protein: 7, carbs: 78, fat: 0.6 };
    await put('users/alice', { heightCm: 180, goalMode: 'deficit', goals: { kcal: 2000 }, quitDate: '2026-10-01', createdAt: at('2026-10-01T10:00:00Z'), ui: { period: 'year' } });
    await put('users/alice/days/2026-11-02', { kcal: 350, proteinG: 7, carbsG: 78, fatG: 0.6, waterMl: 250, weightKg: 80.5, updatedAt: at('2026-11-02T20:00:00Z') });
    await put('users/alice/waterEntries/w1', { day: '2026-11-02', ml: 250, createdAt: at('2026-11-02T08:00:00Z'), deletedAt: null });
    await put('users/alice/waterEntries/w2', { day: '2026-11-02', ml: 500, createdAt: at('2026-11-02T09:00:00Z'), deletedAt: at('2026-11-02T09:05:00Z') });
    await put('users/alice/foodEntries/e1', { day: '2026-11-02', meal: 'lunch', foodRef: { type: 'ciqual', id: '9100' }, foodName: 'Riz blanc, cru', grams: 100, macros, createdAt: at('2026-11-02T12:00:00Z'), updatedAt: at('2026-11-02T12:00:00Z'), deletedAt: null });
    await put('users/alice/foods/f1', { name: 'Pain maison', state: 'other', per100g: { kcal: 250, protein: 8, carbs: 48, fat: 2 }, portions: [{ label: '1 tranche', grams: 30 }], updatedAt: at('2026-11-01T10:00:00Z'), deletedAt: null });
    await put('users/alice/favoriteMeals/m1', { name: 'Déjeuner habituel', items: [{ foodRef: { type: 'ciqual', id: '9100' }, foodName: 'Riz blanc, cru', grams: 150 }], updatedAt: at('2026-11-01T10:00:00Z') });
    await put('users/alice/plans/p1', { name: 'Reprise', active: true, startDay: '2026-11-02', phases: [{ name: 'Phase 1', weeks: 4, sessions: [{ name: 'A', exercises: [{ exerciseId: 'squat', name: 'Squat', sets: 3, reps: 8, incrementKg: 2.5 }] }] }], updatedAt: at('2026-11-01T10:00:00Z') });
    await put('users/alice/workoutLogs/l1', { day: '2026-11-02', planId: 'p1', sessionName: 'A', exerciseIds: ['squat'], sets: [{ exerciseId: 'squat', setNo: 1, reps: 8, kg: 20 }], durationMin: 45, createdAt: at('2026-11-02T18:00:00Z'), deletedAt: null });
    await put('users/alice/milestones/ms1', { metric: 'waistCm', target: 90, direction: 'down', label: 'Tour de taille sous 90 cm', achievedAt: at('2026-11-02T10:00:00Z') });
    await put('users/alice/milestones/ms2', { metric: 'weightKg', target: 75, direction: 'down', label: 'Poids sous 75 kg' });
    await put('users/alice/cravings/c1', { day: '2026-11-02', createdAt: at('2026-11-02T15:00:00Z'), resisted: false });
  });
}

test('an export restores into an empty account: the rules accept every document, the dates survive, what was deleted stays deleted', async () => {
  await seedAccount();
  const { text } = await dataOn(phone()).exportBackup();
  await env.clearFirestore();

  const result = await dataOn(phone()).importBackup(text);
  expect(result).toEqual({ written: 11, failed: 0, firstError: undefined }); // the profile and 10 documents (a glass was taken back)

  const read = async (path: string) => (await getDoc(doc(phone(), path))).data();
  expect(await read('users/alice')).toMatchObject({ heightCm: 180, goalMode: 'deficit', goals: { kcal: 2000 }, quitDate: '2026-10-01', ui: { period: 'year' } });
  expect((await read('users/alice'))?.createdAt.toDate()).toEqual(new Date('2026-10-01T10:00:00Z'));
  expect(await read('users/alice/days/2026-11-02')).toMatchObject({ kcal: 350, weightKg: 80.5 });
  expect(await read('users/alice/waterEntries/w1')).toMatchObject({ ml: 250, deletedAt: null });
  expect(await read('users/alice/waterEntries/w2')).toBeUndefined(); // taken back in the app
  expect((await read('users/alice/milestones/ms1'))?.achievedAt.toDate()).toEqual(new Date('2026-11-02T10:00:00Z'));
  expect((await read('users/alice/milestones/ms2'))?.achievedAt).toBeUndefined();
  expect(await read('users/alice/workoutLogs/l1')).toMatchObject({ durationMin: 45 });
  expect(await read('users/alice/cravings/c1')).toMatchObject({ resisted: false });
  expect((await read('users/alice/foodEntries/e1'))?.macros).toEqual({ kcal: 350, protein: 7, carbs: 78, fat: 0.6 });
});

test('a second restore into the same account fails on what is immutable, and says so, without stopping the rest', async () => {
  await seedAccount();
  const data = dataOn(phone());
  const { text } = await data.exportBackup();
  const result = await data.importBackup(text);
  // The water entry, the workout, the milestone date and the craving cannot be rewritten: the rules only let them be created once.
  // Each collection is a batch of its own, so the others still go through.
  expect(result.failed).toBeGreaterThan(0);
  expect(result.written).toBeGreaterThan(0);
  // The profile and 10 documents, and the date of the milestone (refused: it was already set) counted as one more failure.
  expect(result.written + result.failed).toBe(12);
  expect(result.firstError).toEqual(expect.stringMatching(/\S/));
});

test('the totals are rebuilt from the entries, and the weight of the day is left alone', async () => {
  await seedAccount();
  const db = phone();
  await setDoc(doc(db, 'users/alice/days/2026-11-02'), { kcal: 9999, proteinG: 7, carbsG: 78, fatG: 0.6, waterMl: 250, weightKg: 80.5, updatedAt: Timestamp.now() });
  expect(await dataOn(db).recomputeTotals()).toEqual({ days: 1, corrected: 1 });
  expect((await getDoc(doc(db, 'users/alice/days/2026-11-02'))).data()).toMatchObject({ kcal: 350, waterMl: 250, weightKg: 80.5 });
  expect(await dataOn(db).recomputeTotals()).toEqual({ days: 1, corrected: 0 });
});

test('a profile the rules refuse is counted as failed and reported, and the documents still go through', async () => {
  const data = dataOn(phone());
  const text = JSON.stringify({
    version: 1,
    exportedAt: '2026-11-03T10:00:00.000Z',
    profile: { heightCm: 5 },
    collections: { cravings: [{ id: 'c1', data: { day: '2026-11-02', createdAt: { __timestamp: '2026-11-02T15:00:00.000Z' }, resisted: true } }] },
  });
  const result = await data.importBackup(text);
  expect(result.failed).toBe(1);
  expect(result.written).toBe(1);
  expect(result.firstError).toEqual(expect.stringMatching(/\S/));
});
