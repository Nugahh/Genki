import { firestoreWaterRepository } from '@/modules/hydration/adapters/firestoreWaterRepository';
import { waterUseCases } from '@/modules/hydration';
import { DEFAULT_PROFILE } from '@/modules/settings';
import { firestoreDayTotals } from '@/modules/today/adapters/firestoreDayTotals';
import { db } from '@/platform/firebase';
import { systemClock } from '@/shared/clock';

/** Plugs the adapters into the use cases for the signed-in user, by hand (spec §5). */
export function compose(uid: string) {
  const profile = DEFAULT_PROFILE;
  return {
    profile,
    clock: systemClock,
    hydration: waterUseCases(firestoreWaterRepository(db, uid), systemClock, profile.timezone),
    dayTotals: firestoreDayTotals(db, uid),
  };
}

export type App = ReturnType<typeof compose>;
