import { DEFAULT_PROFILE } from '@/modules/settings';
import { goalsOf } from './goalsOf';

test('the goals of the charts are the amounts of the profile and what the calories are for', () => {
  expect(goalsOf({ ...DEFAULT_PROFILE, goalMode: 'deficit' })).toEqual({ kcal: 2200, kcalMode: 'deficit', proteinG: 130, waterMl: 2500, steps: 8000 });
});
