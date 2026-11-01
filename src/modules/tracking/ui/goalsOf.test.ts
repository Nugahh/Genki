import { DEFAULT_PROFILE } from '@/modules/settings';
import { goalsOf } from './goalsOf';

test('the goals of the charts are the amounts of the profile and what the calories are for', () => {
  expect(goalsOf({ ...DEFAULT_PROFILE, goalMode: 'deficit' }, 2026)).toMatchObject({ kcal: 2200, kcalMode: 'deficit', proteinG: 130, waterMl: 2500, steps: 8000 });
});

test('the references are those of the sex and the age of the profile', () => {
  const man = goalsOf({ ...DEFAULT_PROFILE, sex: 'male', birthYear: 1996 }, 2026).nutrients;
  const woman = goalsOf({ ...DEFAULT_PROFILE, sex: 'female', birthYear: 1996 }, 2026).nutrients;
  expect([man?.vitA, woman?.vitA]).toEqual([750, 650]);
  expect(man?.saturatedFat).toBe(29.3); // 12 % of the 2 200 kcal goal
});

test('a profile under 18 has no references', () => {
  expect(goalsOf({ ...DEFAULT_PROFILE, birthYear: 2010 }, 2026).nutrients).toEqual({});
});
