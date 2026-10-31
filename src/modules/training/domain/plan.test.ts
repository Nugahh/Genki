import { exerciseIdOf, nextSession, planPosition, validatePlan, type NewPlan, type Phase, type Plan } from './plan';

const exercise = (name: string) => ({ exerciseId: exerciseIdOf(name), name, sets: 3, reps: 8, incrementKg: 2.5 });
const session = (name: string) => ({ name, exercises: [exercise('Squat gobelet')] });
const phase = (name: string, weeks: number): Phase => ({ name, weeks, sessions: [session('A'), session('B'), session('C')] });
const newPlan = (): NewPlan => ({ name: 'Reprise', active: true, startDay: '2026-11-02', phases: [phase('Reprise', 4), phase('Construction', 6)] });
const plan = (): Plan => ({ id: 'p1', ...newPlan() });

describe('exerciseIdOf', () => {
  test('is the name without accents, in lower case, with dashes', () => {
    expect(exerciseIdOf('Squat gobelet')).toBe('squat-gobelet');
    expect(exerciseIdOf('  Développé  couché (haltères) ')).toBe('developpe-couche-halteres');
  });
});

describe('planPosition', () => {
  test.each([
    ['2026-11-02', { phaseIndex: 0, week: 1 }], // the first day
    ['2026-11-08', { phaseIndex: 0, week: 1 }], // the sixth day: still the first week
    ['2026-11-09', { phaseIndex: 0, week: 2 }],
    ['2026-11-30', { phaseIndex: 1, week: 1 }], // 4 weeks later
    ['2026-12-28', { phaseIndex: 1, week: 5 }],
    ['2027-01-11', { finished: true }], // 10 weeks later
    ['2026-10-30', { phaseIndex: 0, week: 1 }], // before the start
  ])('on %s the programme is at %j', (today, position) => {
    expect(planPosition(plan(), today)).toEqual(position);
  });
});

describe('nextSession', () => {
  const p = phase('Reprise', 4);
  test('starts with the first session', () => expect(nextSession(p).name).toBe('A'));
  test('follows the last one done', () => expect(nextSession(p, 'A').name).toBe('B'));
  test('comes round after the last one', () => expect(nextSession(p, 'C').name).toBe('A'));
  test('starts again when the last one is not of this phase', () => expect(nextSession(p, 'Z').name).toBe('A'));
});

describe('validatePlan', () => {
  test('accepts a valid programme', () => expect(validatePlan(newPlan())).toBeNull());

  const withExercise = (patch: object): NewPlan => {
    const p = newPlan();
    p.phases[0].sessions[0].exercises[0] = { ...p.phases[0].sessions[0].exercises[0], ...patch };
    return p;
  };
  const withPhase = (patch: Partial<Phase>): NewPlan => {
    const p = newPlan();
    p.phases[0] = { ...p.phases[0], ...patch };
    return p;
  };

  test.each([
    ['no phase', { ...newPlan(), phases: [] }],
    ['13 phases', { ...newPlan(), phases: Array.from({ length: 13 }, (_, i) => phase(`P${i}`, 1)) }],
    ['a blank name', { ...newPlan(), name: '  ' }],
    ['a name of 101 characters', { ...newPlan(), name: 'x'.repeat(101) }],
    ['0 weeks', withPhase({ weeks: 0 })],
    ['53 weeks', withPhase({ weeks: 53 })],
    ['a fractional number of weeks', withPhase({ weeks: 1.5 })],
    ['no session', withPhase({ sessions: [] })],
    ['15 sessions', withPhase({ sessions: Array.from({ length: 15 }, (_, i) => session(`S${i}`)) })],
    ['a session with no exercise', withPhase({ sessions: [{ name: 'A', exercises: [] }] })],
    ['21 exercises', withPhase({ sessions: [{ name: 'A', exercises: Array.from({ length: 21 }, (_, i) => exercise(`E${i}`)) }] })],
    ['0 sets', withExercise({ sets: 0 })],
    ['21 sets', withExercise({ sets: 21 })],
    ['a fractional number of sets', withExercise({ sets: 2.5 })],
    ['0 reps', withExercise({ reps: 0 })],
    ['1001 reps', withExercise({ reps: 1001 })],
    ['a negative increment', withExercise({ incrementKg: -1 })],
    ['an increment of 51 kg', withExercise({ incrementKg: 51 })],
    ['a blank exercise name', withExercise({ name: ' ' })],
    ['a start day that is not a day', { ...newPlan(), startDay: 'demain' }],
  ] as [string, NewPlan][])('refuses %s with a message', (_, invalid) => {
    expect(validatePlan(invalid)).toEqual(expect.stringMatching(/\S/));
  });
});
