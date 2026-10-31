import { validateWorkout, type NewWorkoutLog } from './workout';

const log = (): NewWorkoutLog => ({
  day: '2026-11-03',
  planId: 'p1',
  sessionName: 'Séance A',
  exerciseIds: ['squat-gobelet'],
  sets: [{ exerciseId: 'squat-gobelet', setNo: 1, reps: 8, kg: 20 }],
  durationMin: 45,
  createdAt: new Date('2026-11-03T10:00:00Z'),
});

test('accepts a workout with a done set', () => expect(validateWorkout(log())).toBeNull());

test.each([
  ['no set', { sets: [] }],
  ['a set number below 1', { sets: [{ exerciseId: 'a', setNo: 0, reps: 8, kg: 20 }] }],
  ['negative reps', { sets: [{ exerciseId: 'a', setNo: 1, reps: -1, kg: 20 }] }],
  ['1001 reps', { sets: [{ exerciseId: 'a', setNo: 1, reps: 1001, kg: 20 }] }],
  ['fractional reps', { sets: [{ exerciseId: 'a', setNo: 1, reps: 7.5, kg: 20 }] }],
  ['a negative load', { sets: [{ exerciseId: 'a', setNo: 1, reps: 8, kg: -2 }] }],
  ['a load of 1001 kg', { sets: [{ exerciseId: 'a', setNo: 1, reps: 8, kg: 1001 }] }],
  ['a load that is not a number', { sets: [{ exerciseId: 'a', setNo: 1, reps: 8, kg: NaN }] }],
  ['401 sets', { sets: Array.from({ length: 401 }, () => ({ exerciseId: 'a', setNo: 1, reps: 8, kg: 20 })) }],
])('refuses %s with a message', (_, patch) => {
  expect(validateWorkout({ ...log(), ...patch })).toEqual(expect.stringMatching(/\S/));
});

test('accepts the 400 sets that 20 exercises of 20 sets make', () => {
  expect(validateWorkout({ ...log(), sets: Array.from({ length: 400 }, () => ({ exerciseId: 'a', setNo: 1, reps: 8, kg: 20 })) })).toBeNull();
});
