import { reachedByMeasure, rollingMean, validateMeasure } from './body';

describe('rollingMean', () => {
  test('is the mean of the days that have a value', () => expect(rollingMean([80, undefined, 79, 81])).toBe(80));
  test('is nothing when no day has one', () => expect(rollingMean([undefined, undefined])).toBeUndefined());
  test('is nothing for no day', () => expect(rollingMean([])).toBeUndefined());
});

describe('validateMeasure', () => {
  test('accepts a weight, a waist, or both', () => {
    expect(validateMeasure({ weightKg: 80 })).toBeNull();
    expect(validateMeasure({ waistCm: 90.5 })).toBeNull();
    expect(validateMeasure({ weightKg: 80, waistCm: 90 })).toBeNull();
  });

  test.each([
    ['nothing', {}],
    ['a weight under 20', { weightKg: 19 }],
    ['a weight over 400', { weightKg: 401 }],
    ['a weight that is not a number', { weightKg: NaN }],
    ['a waist under 30', { waistCm: 29 }],
    ['a waist over 300', { waistCm: 301 }],
  ])('refuses %s with a message', (_, measure) => expect(validateMeasure(measure)).toEqual(expect.stringMatching(/\S/)));
});

describe('reachedByMeasure', () => {
  const waist = { id: 'm1', metric: 'waistCm', target: 90, direction: 'down' as const };
  const weight = { id: 'm2', metric: 'weightKg', target: 85, direction: 'up' as const };

  test('a waist under the target reaches a "down" milestone, a weight over reaches an "up" one', () => {
    expect(reachedByMeasure([waist, weight], { waistCm: 89.5, weightKg: 86 })).toEqual(['m1', 'm2']);
  });

  test('the target itself is reached', () => expect(reachedByMeasure([waist], { waistCm: 90 })).toEqual(['m1']));
  test('a measure that is not taken reaches nothing', () => expect(reachedByMeasure([waist, weight], { weightKg: 80 })).toEqual([]));
  test('an achieved milestone, or an exercise one, is left alone', () => {
    expect(reachedByMeasure([{ ...waist, achievedAt: new Date() }, { id: 'm3', metric: 'exercise:squat:kg', target: 1, direction: 'up' }], { waistCm: 80 })).toEqual([]);
  });
});
