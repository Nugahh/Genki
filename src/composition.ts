import { firestoreWaterRepository } from '@/modules/hydration/adapters/firestoreWaterRepository';
import { waterUseCases } from '@/modules/hydration';
import { ciqualCatalog } from '@/modules/nutrition/adapters/ciqualCatalog';
import { firestoreFavoriteMealRepository } from '@/modules/nutrition/adapters/firestoreFavoriteMealRepository';
import { firestoreFoodEntryRepository } from '@/modules/nutrition/adapters/firestoreFoodEntryRepository';
import { firestoreFoodRepository } from '@/modules/nutrition/adapters/firestoreFoodRepository';
import { foodUseCases, mealUseCases } from '@/modules/nutrition';
import { firestoreMilestoneRepository } from '@/modules/training/adapters/firestoreMilestoneRepository';
import { firestorePlanRepository } from '@/modules/training/adapters/firestorePlanRepository';
import { firestoreWorkoutRepository } from '@/modules/training/adapters/firestoreWorkoutRepository';
import { trainingUseCases } from '@/modules/training';
import { DEFAULT_PROFILE, settingsUseCases } from '@/modules/settings';
import { firestoreProfileRepository } from '@/modules/settings/adapters/firestoreProfileRepository';
import { firestoreDaysSource } from '@/modules/tracking/adapters/firestoreDaysSource';
import { trainingFactsSource } from '@/modules/tracking/adapters/trainingFactsSource';
import { trackingUseCases } from '@/modules/tracking';
import { firestoreDayTotals } from '@/modules/today/adapters/firestoreDayTotals';
import { openCiqual } from '@/platform/ciqual';
import { db } from '@/platform/firebase';
import { systemClock } from '@/shared/clock';

/** Plugs the adapters into the use cases for the signed-in user, by hand (spec §5). */
export function compose(uid: string) {
  const profile = DEFAULT_PROFILE;
  const training = trainingUseCases({
    plans: firestorePlanRepository(db, uid),
    workouts: firestoreWorkoutRepository(db, uid),
    milestones: firestoreMilestoneRepository(db, uid),
    clock: systemClock,
    timezone: profile.timezone,
  });
  return {
    profile,
    clock: systemClock,
    hydration: waterUseCases(firestoreWaterRepository(db, uid), systemClock, profile.timezone),
    dayTotals: firestoreDayTotals(db, uid),
    training,
    settings: settingsUseCases(firestoreProfileRepository(db, uid)),
    tracking: trackingUseCases({ sources: [firestoreDaysSource(db, uid), trainingFactsSource(training)], goals: profile.goals, clock: systemClock, timezone: profile.timezone }),
    nutrition: {
      meals: mealUseCases({
        entries: firestoreFoodEntryRepository(db, uid),
        favorites: firestoreFavoriteMealRepository(db, uid),
        clock: systemClock,
        timezone: profile.timezone,
      }),
      foods: foodUseCases({ catalog: ciqualCatalog(openCiqual), repo: firestoreFoodRepository(db, uid) }),
    },
  };
}

export type App = ReturnType<typeof compose>;
