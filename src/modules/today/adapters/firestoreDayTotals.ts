import { doc, onSnapshot, type Firestore } from '@react-native-firebase/firestore';
import type { DayTotalsRepository } from '../application/ports';

export function firestoreDayTotals(db: Firestore, uid: string): DayTotalsRepository {
  return {
    observe(day, onNext, onError) {
      return onSnapshot(
        doc(db, 'users', uid, 'days', day),
        // Metadata changes too: the sync icon follows hasPendingWrites and fromCache (spec §6).
        { includeMetadataChanges: true },
        (snapshot) =>
          onNext(
            { waterMl: snapshot.data()?.waterMl ?? 0 },
            { hasPendingWrites: snapshot.metadata.hasPendingWrites, fromCache: snapshot.metadata.fromCache },
          ),
        onError,
      );
    },
  };
}
