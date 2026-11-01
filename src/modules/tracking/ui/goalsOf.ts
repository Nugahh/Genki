import { referencesOf } from '@/modules/nutrition';
import type { Profile } from '@/modules/settings';
import type { Goals } from '../domain/metric';

/** The goals the charts measure against, from the profile: the amounts, what the calories goal is for, and the reference intakes for the sex and age. */
export const goalsOf = (profile: Profile, year?: number): Goals => ({ ...profile.goals, kcalMode: profile.goalMode, nutrients: referencesOf(profile, year) });
