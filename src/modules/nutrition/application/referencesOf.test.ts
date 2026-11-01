import { DEFAULT_PROFILE } from '@/modules/settings';
import { referencesOf } from './referencesOf';

test('the references are those of the sex and the age (the difference of years) of the profile', () => {
  expect(referencesOf({ ...DEFAULT_PROFILE, sex: 'male', birthYear: 1996 }, 2026).vitA).toBe(750);
  expect(referencesOf({ ...DEFAULT_PROFILE, sex: 'female', birthYear: 1996 }, 2026).vitA).toBe(650);
  expect(referencesOf({ ...DEFAULT_PROFILE, birthYear: 2000 }, 2026).calcium).toBe(950); // 26
  expect(referencesOf({ ...DEFAULT_PROFILE, birthYear: 2000 }, 2024).calcium).toBe(1000); // 24
  expect(referencesOf({ ...DEFAULT_PROFILE, birthYear: 2000 }, 2025).calcium).toBe(950); // 25
});

test('the saturated fat ceiling follows the calories goal of the profile', () => {
  expect(referencesOf({ ...DEFAULT_PROFILE, goals: { ...DEFAULT_PROFILE.goals, kcal: 1800 } }, 2026).saturatedFat).toBe(24);
});

test('a profile under 18 has none', () => {
  expect(referencesOf({ ...DEFAULT_PROFILE, birthYear: 2012 }, 2026)).toEqual({});
});
