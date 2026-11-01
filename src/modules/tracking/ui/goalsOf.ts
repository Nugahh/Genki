import { referencesFor } from '@/modules/nutrition';
import type { Profile } from '@/modules/settings';
import type { Goals } from '../domain/metric';

/** The goals the charts measure against, from the profile: the amounts, what the calories goal is for, and the reference intakes for the sex and age. */
export const goalsOf = (profile: Profile, year = new Date().getFullYear()): Goals => ({
  ...profile.goals,
  kcalMode: profile.goalMode,
  // shortcut: the age is the difference of years (up to a year early for a birthday still to come); only the calcium at 25 and the 18-year floor notice.
  nutrients: referencesFor({ sex: profile.sex, age: year - profile.birthYear }, profile.goals.kcal),
});
