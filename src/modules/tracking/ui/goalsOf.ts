import type { Profile } from '@/modules/settings';
import type { Goals } from '../domain/metric';

/** The goals the charts measure against, from the profile: the amounts, and what the calories goal is for. */
export const goalsOf = (profile: Profile): Goals => ({ ...profile.goals, kcalMode: profile.goalMode });
