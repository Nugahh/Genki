import { exerciseIdOf, validatePlan } from './plan';
import { starterPlan } from './template';

const plan = starterPlan('2026-11-02');
const exercises = plan.phases.flatMap((phase) => phase.sessions.flatMap((session) => session.exercises));

test('is an active programme that starts on the day given and passes the programme rules', () => {
  expect(plan).toMatchObject({ name: 'Reprise progressive', active: true, startDay: '2026-11-02' });
  expect(validatePlan(plan)).toBeNull();
});

test('has three phases of 4, 6 and 6 weeks, each with three sessions A, B and C', () => {
  expect(plan.phases.map((p) => [p.name, p.weeks])).toEqual([
    ['Reprise', 4],
    ['Construction', 6],
    ['Force et explosivité', 6],
  ]);
  for (const phase of plan.phases) expect(phase.sessions.map((s) => s.name.slice(0, 8))).toEqual(['Séance A', 'Séance B', 'Séance C']);
});

test('names each exercise by its id, so the same exercise shares its history from one phase to the next', () => {
  for (const e of exercises) expect(e.exerciseId).toBe(exerciseIdOf(e.name));
  const squat = plan.phases.map((p) => p.sessions[1].exercises.find((e) => e.name === 'Squat gobelet'));
  expect(squat.every((e) => e?.exerciseId === 'squat-gobelet')).toBe(true);
});

test('does not repeat an exercise within a session', () => {
  for (const phase of plan.phases) for (const session of phase.sessions) {
    const ids = session.exercises.map((e) => e.exerciseId);
    expect(new Set(ids).size).toBe(ids.length);
  }
});

test('adds no load to body-weight work, and counts holds in seconds', () => {
  for (const e of exercises.filter((x) => ['Pompes', 'Tractions', 'Dips sur banc'].some((n) => x.name.startsWith(n)))) expect(e.incrementKg).toBe(0);
  for (const e of exercises.filter((x) => x.name.startsWith('Gainage'))) expect(e.name).toMatch(/secondes/);
});
