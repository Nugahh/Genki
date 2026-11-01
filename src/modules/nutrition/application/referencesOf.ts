import type { Profile } from '@/modules/settings';
import type { Nutrients } from '../domain/nutrients';
import { referencesFor } from '../domain/references';

// shortcut: the age is the difference of years (up to a year early for a birthday still to come); only the calcium at 25 and the 18-year floor notice.
/** The reference intakes of the profile: its sex, its age, and the calories goal for the saturated fat ceiling. */
export const referencesOf = (profile: Profile, year = new Date().getFullYear()): Nutrients =>
  referencesFor({ sex: profile.sex, age: year - profile.birthYear }, profile.goals.kcal);
