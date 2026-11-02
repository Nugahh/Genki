import { firestoreWaterRepository } from '@/modules/hydration/adapters/firestoreWaterRepository';
import { waterUseCases } from '@/modules/hydration';
import { ciqualCatalog } from '@/modules/nutrition/adapters/ciqualCatalog';
import { openFoodFactsClient } from '@/modules/nutrition/adapters/openFoodFactsClient';
import { firestoreFavoriteMealRepository } from '@/modules/nutrition/adapters/firestoreFavoriteMealRepository';
import { firestoreFoodEntryRepository } from '@/modules/nutrition/adapters/firestoreFoodEntryRepository';
import { firestoreFoodRepository } from '@/modules/nutrition/adapters/firestoreFoodRepository';
import { foodUseCases, mealUseCases, productSearch, starredFoodUseCases } from '@/modules/nutrition';
import { firestoreStarredFoodRepository } from '@/modules/nutrition/adapters/firestoreStarredFoodRepository';
import { rateLimiter } from '@/modules/nutrition/domain/rateLimiter';
import { firestoreMilestoneRepository } from '@/modules/training/adapters/firestoreMilestoneRepository';
import { firestorePlanRepository } from '@/modules/training/adapters/firestorePlanRepository';
import { firestoreWorkoutRepository } from '@/modules/training/adapters/firestoreWorkoutRepository';
import { trainingUseCases } from '@/modules/training';
import { DEFAULT_PROFILE, settingsUseCases } from '@/modules/settings';
import { firestoreProfileRepository } from '@/modules/settings/adapters/firestoreProfileRepository';
import { firestoreDaysSource } from '@/modules/tracking/adapters/firestoreDaysSource';
import { mealsFactsSource } from '@/modules/tracking/adapters/mealsFactsSource';
import { trainingFactsSource } from '@/modules/tracking/adapters/trainingFactsSource';
import { trackingUseCases } from '@/modules/tracking';
import { firestoreDayTotals } from '@/modules/today/adapters/firestoreDayTotals';
import { firestoreBodyRepository } from '@/modules/body/adapters/firestoreBodyRepository';
import { bodyUseCases } from '@/modules/body';
import { firestoreCravingRepository } from '@/modules/tobacco/adapters/firestoreCravingRepository';
import { tobaccoUseCases } from '@/modules/tobacco';
import { tobaccoFactsSource } from '@/modules/tracking/adapters/tobaccoFactsSource';
import { firestoreDataStore } from '@/modules/data/adapters/firestoreDataStore';
import { dataUseCases } from '@/modules/data';
import { healthConnectSource } from '@/modules/steps/adapters/healthConnectSource';
import { firestoreStepsRepository } from '@/modules/steps/adapters/firestoreStepsRepository';
import { stepsUseCases } from '@/modules/steps';
import { openCiqual } from '@/platform/ciqual';
import { thisDevice } from '@/platform/device';
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
  const meals = mealUseCases({
    entries: firestoreFoodEntryRepository(db, uid),
    favorites: firestoreFavoriteMealRepository(db, uid),
    clock: systemClock,
    timezone: profile.timezone,
  });
  const tobacco = tobaccoUseCases({ repo: firestoreCravingRepository(db, uid), clock: systemClock, timezone: profile.timezone });
  return {
    profile,
    clock: systemClock,
    hydration: waterUseCases(firestoreWaterRepository(db, uid), systemClock, profile.timezone),
    dayTotals: firestoreDayTotals(db, uid),
    training,
    tobacco,
    steps: stepsUseCases({ health: healthConnectSource(), repo: firestoreStepsRepository(db, uid), device: thisDevice, clock: systemClock, timezone: profile.timezone }),
    data: dataUseCases({ store: firestoreDataStore(db, uid), clock: systemClock, timezone: profile.timezone }),
    body: bodyUseCases({ repo: firestoreBodyRepository(db, uid), milestones: training.listMilestones, clock: systemClock, timezone: profile.timezone }),
    settings: settingsUseCases(firestoreProfileRepository(db, uid)),
    tracking: trackingUseCases({ sources: { days: firestoreDaysSource(db, uid), training: trainingFactsSource(training), tobacco: tobaccoFactsSource(tobacco), meals: mealsFactsSource(meals) }, clock: systemClock, timezone: profile.timezone }),
    nutrition: {
      meals,
      starred: starredFoodUseCases(firestoreStarredFoodRepository(db, uid)),
      foods: foodUseCases({ catalog: ciqualCatalog(openCiqual), repo: firestoreFoodRepository(db, uid) }),
      // Open Food Facts allows 10 searches and 15 product reads a minute.
      products: productSearch({ source: openFoodFactsClient(), limiter: rateLimiter(10, 60000, Date.now), lookupLimiter: rateLimiter(15, 60000, Date.now) }),
    },
  };
}

export type App = ReturnType<typeof compose>;
