import { doc, onSnapshot, type Firestore } from '@react-native-firebase/firestore';
import type { DayTotalsRepository } from '../application/ports';

// A total can sit a hair below zero (sums of 0.1-rounded floats, the rules allow -0.05): shown as 0.
const total = (value: unknown) => Math.max(0, typeof value === 'number' ? value : 0);

export function firestoreDayTotals(db: Firestore, uid: string): DayTotalsRepository {
  return {
    observe(day, onNext, onError) {
      return onSnapshot(
        doc(db, 'users', uid, 'days', day),
        // Metadata changes too: the sync icon follows hasPendingWrites and fromCache (spec §6).
        { includeMetadataChanges: true },
        (snapshot) => {
          const data = snapshot.data();
          onNext(
            {
              waterMl: total(data?.waterMl),
              kcal: total(data?.kcal),
              proteinG: total(data?.proteinG),
              carbsG: total(data?.carbsG),
              fatG: total(data?.fatG),
              steps: total(data?.steps),
              stepsSource: typeof data?.stepsSource === 'string' ? data.stepsSource : undefined,
              stepsSyncedAt: data?.stepsSyncedAt?.toDate?.(),
            },
            { hasPendingWrites: snapshot.metadata.hasPendingWrites, fromCache: snapshot.metadata.fromCache },
          );
        },
        onError,
      );
    },
  };
}
