import { exerciseMetric, isReached, reachedBy, validateMilestone, type Milestone } from './milestone';
import type { LoggedSet } from './workout';

const set = (exerciseId: string, reps: number, kg: number): LoggedSet => ({ exerciseId, setNo: 1, reps, kg });
const pullups = (patch: Partial<Milestone> = {}): Milestone => ({ id: 'm1', metric: 'exercise:tractions:reps', target: 10, direction: 'up', label: '10 tractions', ...patch });

test('exerciseMetric names the metric of an exercise', () => {
  expect(exerciseMetric('squat-gobelet', 'kg')).toBe('exercise:squat-gobelet:kg');
  expect(exerciseMetric('tractions', 'reps')).toBe('exercise:tractions:reps');
});

test('isReached crosses the target in the direction given, equality included', () => {
  expect(isReached({ target: 10, direction: 'up' }, 10)).toBe(true);
  expect(isReached({ target: 10, direction: 'up' }, 9)).toBe(false);
  expect(isReached({ target: 60, direction: 'down' }, 60)).toBe(true);
  expect(isReached({ target: 60, direction: 'down' }, 61)).toBe(false);
});

describe('reachedBy', () => {
  test('is the milestones this workout crosses, on its best set', () => {
    expect(reachedBy([pullups()], [set('tractions', 6, 0), set('tractions', 10, 0)])).toEqual([pullups()]);
    expect(reachedBy([pullups()], [set('tractions', 6, 0), set('tractions', 9, 0)])).toEqual([]);
  });
  test('reads the heaviest load for a load milestone', () => {
    const squat = pullups({ metric: 'exercise:squat-gobelet:kg', target: 40, label: 'Squat à 40 kg' });
    expect(reachedBy([squat], [set('squat-gobelet', 5, 30), set('squat-gobelet', 5, 40)])).toEqual([squat]);
  });
  test('skips a milestone already achieved, or whose exercise was not done', () => {
    expect(reachedBy([pullups({ achievedAt: new Date() })], [set('tractions', 12, 0)])).toEqual([]);
    expect(reachedBy([pullups()], [set('pompes', 30, 0)])).toEqual([]);
  });
  test('goes down for a milestone of direction down', () => {
    const light = pullups({ metric: 'exercise:gilet:kg', target: 5, direction: 'down' });
    expect(reachedBy([light], [set('gilet', 8, 4)])).toEqual([light]);
  });
});

describe('validateMilestone', () => {
  const valid = { metric: 'exercise:tractions:reps', target: 10, direction: 'up' as const, label: '10 tractions' };
  test('accepts a valid milestone', () => expect(validateMilestone(valid)).toBeNull());
  test.each([
    ['a blank label', { label: ' ' }],
    ['a label of 101 characters', { label: 'x'.repeat(101) }],
    ['a negative target', { target: -1 }],
    ['a target above 100 000', { target: 100001 }],
    ['a target that is not a number', { target: NaN }],
    ['a metric that is not an exercise metric', { metric: 'weightKg' }],
    ['a metric of an unknown kind', { metric: 'exercise:tractions:speed' }],
  ])('refuses %s with a message', (_, patch) => {
    expect(validateMilestone({ ...valid, ...patch })).toEqual(expect.stringMatching(/\S/));
  });
});
