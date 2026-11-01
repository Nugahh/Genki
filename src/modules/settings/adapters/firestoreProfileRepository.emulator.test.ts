import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, setDoc, setLogLevel, type Firestore } from 'firebase/firestore';
import { readFileSync } from 'node:fs';
import type { StoredProfile } from '../application/ports';
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

test('the month is a period that is saved and read back', async () => {
  const db = phone();
  await profileOn(db).saveUi({ period: 'month' });
  expect(await observed(db)).toEqual({ period: 'month' });
});

test('a second phone sees what the first saved', async () => {
  await profileOn(phone()).saveUi({ hubMetrics: ['steps'] });
  expect(await observed(phone())).toEqual({ hubMetrics: ['steps'] });
});

test('preferences the rules refuse are rejected', async () => {
  await expect(profileOn(phone()).saveUi({ period: 'quarter' as never })).rejects.toThrow();
});

const storedProfile = (db: Firestore) =>
  new Promise<StoredProfile>((resolve, reject) => {
    const stop = profileOn(db).observeProfile((stored) => {
      stop();
      resolve(stored);
    }, reject);
  });

describe('the profile', () => {
  test('nothing is stored until something is saved', async () => {
    expect(await storedProfile(phone())).toEqual({});
  });

  test('saved fields come back, the goals merged field by field, and the creation time as a date', async () => {
    const db = phone();
    await profileOn(db).saveProfile({ heightCm: 182, goalMode: 'deficit', goals: { kcal: 2000 } as never });
    await profileOn(db).saveProfile({ goals: { steps: 9000 } as never, createdAt: new Date('2026-11-01T10:00:00Z') });
    expect(await storedProfile(db)).toEqual({ heightCm: 182, goalMode: 'deficit', goals: { kcal: 2000, steps: 9000 }, createdAt: new Date('2026-11-01T10:00:00Z') });
  });

  test('a field set to null is taken off', async () => {
    const db = phone();
    await profileOn(db).saveProfile({ quitDate: '2026-10-01', packPrice: 11 });
    await profileOn(db).saveProfile({ quitDate: null });
    expect(await storedProfile(db)).toEqual({ packPrice: 11, goals: {} });
  });

  test('the display preferences and the profile share one document without touching each other', async () => {
    const db = phone();
    await profileOn(db).saveUi({ period: 'year' });
    await profileOn(db).saveProfile({ heightCm: 170 });
    expect(await observed(db)).toEqual({ period: 'year' });
    expect((await storedProfile(db)).heightCm).toBe(170);
  });

  test('a value the rules refuse is rejected', async () => {
    await expect(profileOn(phone()).saveProfile({ heightCm: 90 })).rejects.toThrow();
  });
});

test('fields of the wrong shape, or a time zone Intl does not know, are left out so that the default shows', async () => {
  await env.withSecurityRulesDisabled((ctx) =>
    setDoc(doc(ctx.firestore() as unknown as Firestore, 'users/alice'), {
      heightCm: 'tall',
      sex: 'x',
      timezone: 'Mars/Base',
      goalMode: 'deficit',
      goals: { kcal: 'lots', steps: 9000 },
      waterContainers: [{ label: 'Verre', ml: 250 }, { label: 3 }, 'oops'],
    }),
  );
  expect(await storedProfile(phone())).toEqual({ goalMode: 'deficit', goals: { steps: 9000 }, waterContainers: [{ label: 'Verre', ml: 250 }] });
});
