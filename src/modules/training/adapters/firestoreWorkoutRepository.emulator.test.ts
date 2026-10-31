import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { disableNetwork, enableNetwork, setLogLevel, type Firestore } from 'firebase/firestore';
import { readFileSync } from 'node:fs';
import type { NewWorkoutLog, WorkoutLog } from '../domain/workout';
import { firestoreMilestoneRepository } from './firestoreMilestoneRepository';
import { firestoreWorkoutRepository } from './firestoreWorkoutRepository';

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

const workoutsOn = (db: Firestore) => firestoreWorkoutRepository(db as never, 'alice');

const log = (day: string, exerciseIds: string[], at = `${day}T10:00:00Z`): NewWorkoutLog => ({
  day,
  planId: 'p1',
  sessionName: 'Séance A',
  exerciseIds,
  sets: exerciseIds.map((exerciseId) => ({ exerciseId, setNo: 1, reps: 8, kg: 20 })),
  durationMin: 45,
  createdAt: new Date(at),
});

const latest = (db: Firestore) =>
  new Promise<WorkoutLog | undefined>((resolve, reject) => {
    const stop = workoutsOn(db).observeLatest((l) => {
      stop();
      resolve(l);
    }, reject);
  });

test('a recorded workout comes back with an id and what was written', async () => {
  const db = phone();
  await workoutsOn(db).add(log('2026-11-03', ['squat']));
  expect(await workoutsOn(db).latestWithExercise('squat')).toEqual({ id: expect.any(String), ...log('2026-11-03', ['squat']) });
});

test('the latest workout that holds an exercise is the newest day, and history lists them newest first within the limit', async () => {
  const db = phone();
  await workoutsOn(db).add(log('2026-11-03', ['squat', 'pompes']));
  await workoutsOn(db).add(log('2026-11-10', ['squat']));
  await workoutsOn(db).add(log('2026-11-07', ['pompes']));
  expect((await workoutsOn(db).latestWithExercise('squat'))?.day).toBe('2026-11-10');
  expect((await workoutsOn(db).latestWithExercise('pompes'))?.day).toBe('2026-11-07');
  expect((await workoutsOn(db).history('squat', 10)).map((l) => l.day)).toEqual(['2026-11-10', '2026-11-03']);
  expect((await workoutsOn(db).history('squat', 1)).map((l) => l.day)).toEqual(['2026-11-10']);
  expect(await workoutsOn(db).latestWithExercise('tractions')).toBeUndefined();
  expect(await workoutsOn(db).history('tractions', 10)).toEqual([]);
});

test('the latest workout, whatever its exercises, is the last one created', async () => {
  const db = phone();
  expect(await latest(db)).toBeUndefined();
  await workoutsOn(db).add(log('2026-11-03', ['squat']));
  await workoutsOn(db).add(log('2026-11-02', ['pompes'], '2026-11-03T12:00:00Z'));
  expect((await latest(db))?.sessionName).toBe('Séance A');
  expect((await latest(db))?.exerciseIds).toEqual(['pompes']);
});

test('the workouts between two days are observed, both days included', async () => {
  const db = phone();
  for (const day of ['2026-11-01', '2026-11-02', '2026-11-08', '2026-11-09']) await workoutsOn(db).add(log(day, ['squat']));
  const days = await new Promise<string[]>((resolve, reject) => {
    const stop = workoutsOn(db).observeBetween('2026-11-02', '2026-11-08', (logs) => {
      stop();
      resolve(logs.map((l) => l.day).sort());
    }, reject);
  });
  expect(days).toEqual(['2026-11-02', '2026-11-08']);
});

test('a workout sets the date of the milestones it reaches, once, in the same batch as its log', async () => {
  const db = phone();
  const milestones = firestoreMilestoneRepository(db as never, 'alice');
  await milestones.create({ metric: 'exercise:squat:kg', target: 20, direction: 'up', label: 'Squat à 20 kg' });
  const [created] = await milestones.list();
  await workoutsOn(db).add(log('2026-11-03', ['squat']), [created.id]);
  expect((await milestones.list())[0].achievedAt).toEqual(new Date('2026-11-03T10:00:00Z'));
  // The rules set the date once: a second workout naming the milestone is refused as a whole, log included.
  await expect(workoutsOn(db).add(log('2026-11-09', ['squat']), [created.id])).rejects.toThrow();
  expect((await workoutsOn(db).history('squat', 10)).map((l) => l.day)).toEqual(['2026-11-03']);
});

test('a workout whose milestone is gone is not recorded: all or nothing', async () => {
  const db = phone();
  await expect(workoutsOn(db).add(log('2026-11-03', ['squat']), ['gone'])).rejects.toThrow();
  expect(await workoutsOn(db).history('squat', 10)).toEqual([]);
});

test('a workout with no set is refused', async () => {
  await expect(workoutsOn(phone()).add({ ...log('2026-11-03', ['squat']), sets: [] })).rejects.toThrow();
});

test('two phones recording a workout offline end up with both (spec §10)', async () => {
  const [a, b] = [phone(), phone()];
  await Promise.all([disableNetwork(a), disableNetwork(b)]);
  const writes = [workoutsOn(a).add(log('2026-11-03', ['squat'])), workoutsOn(b).add(log('2026-11-04', ['squat']))];
  await Promise.all([enableNetwork(a), enableNetwork(b)]);
  await Promise.all(writes);
  expect((await workoutsOn(a).history('squat', 10)).map((l) => l.day)).toEqual(['2026-11-04', '2026-11-03']);
});
