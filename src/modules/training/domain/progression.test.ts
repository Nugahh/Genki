import type { PlannedExercise } from './plan';
import { prefillSets, suggestedKg, suggestionsFor } from './progression';
import type { LoggedSet } from './workout';

const squat: PlannedExercise = { exerciseId: 'squat-gobelet', name: 'Squat gobelet', sets: 3, reps: 8, incrementKg: 2.5 };
const pushups: PlannedExercise = { exerciseId: 'pompes', name: 'Pompes', sets: 3, reps: 8, incrementKg: 0 };
const sets = (exerciseId: string, reps: number[], kg: number | number[]): LoggedSet[] =>
  reps.map((r, i) => ({ exerciseId, setNo: i + 1, reps: r, kg: Array.isArray(kg) ? kg[i] : kg }));

describe('suggestedKg (spec §9)', () => {
  test('is 0 with no history', () => expect(suggestedKg([], squat)).toBe(0));
  test('adds the increment when every planned set reached the planned reps', () => {
    expect(suggestedKg(sets('squat-gobelet', [8, 8, 8], 20), squat)).toBe(22.5);
    expect(suggestedKg(sets('squat-gobelet', [10, 9, 8], 20), squat)).toBe(22.5); // more reps than planned is fine
  });
  test('keeps the load when a set fell short', () => expect(suggestedKg(sets('squat-gobelet', [8, 8, 6], 20), squat)).toBe(20));
  test('keeps the load when fewer sets than planned were done', () => expect(suggestedKg(sets('squat-gobelet', [8, 8], 20), squat)).toBe(20));
  test('goes from the heaviest set', () => expect(suggestedKg(sets('squat-gobelet', [8, 8, 8], [20, 22.5, 22.5]), squat)).toBe(25));
  test('has nothing to add to a body-weight exercise', () => expect(suggestedKg(sets('pompes', [8, 8, 8], 0), pushups)).toBe(0));
  test('rounds to hundredths', () => expect(suggestedKg(sets('squat-gobelet', [8, 8, 8], 20.1), { ...squat, incrementKg: 0.2 })).toBe(20.3));
});

describe('prefillSets', () => {
  test('gives the planned number of sets at the planned reps, on the suggested load', () => {
    expect(prefillSets(squat, sets('squat-gobelet', [8, 8, 8], 20))).toEqual([
      { kg: 22.5, reps: 8 },
      { kg: 22.5, reps: 8 },
      { kg: 22.5, reps: 8 },
    ]);
  });
  test('starts at 0 kg the first time', () => expect(prefillSets(squat, [])).toEqual(Array(3).fill({ kg: 0, reps: 8 })));
});

describe('suggestionsFor', () => {
  const done = [...sets('squat-gobelet', [8, 8, 8], 20), ...sets('pompes', [8, 8, 8], 0)];

  test('lists the exercises whose load goes up, from the heaviest set done', () => {
    expect(suggestionsFor([squat, pushups], done)).toEqual([{ exerciseId: 'squat-gobelet', name: 'Squat gobelet', fromKg: 20, toKg: 22.5 }]);
  });
  test('lists nothing for a set that fell short, or an exercise that was not done', () => {
    expect(suggestionsFor([squat], sets('squat-gobelet', [8, 5, 8], 20))).toEqual([]);
    expect(suggestionsFor([squat], [])).toEqual([]);
  });
});
