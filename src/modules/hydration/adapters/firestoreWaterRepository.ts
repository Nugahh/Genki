import {
  collection,
  doc,
  increment,
  onSnapshot,
  query,
  serverTimestamp,
  Timestamp,
  where,
  writeBatch,
  type Firestore,
  type WriteBatch,
} from '@react-native-firebase/firestore';
import type { NewWaterEntry, WaterEntry, WaterRepository } from '../application/ports';

/** Glasses in `users/{uid}/waterEntries`; each write moves `days/{day}.waterMl` in the same batch (spec §4). */
export function firestoreWaterRepository(db: Firestore, uid: string): WaterRepository {
  const entries = collection(db, 'users', uid, 'waterEntries');

  // increment() adds up on the server: glasses logged offline on two phones sum instead of overwriting.
  const moveDayTotal = (batch: WriteBatch, day: string, ml: number) =>
    batch.set(
      doc(db, 'users', uid, 'days', day),
      { waterMl: increment(ml), updatedAt: serverTimestamp() },
      { merge: true },
    );

  return {
    add(entry: NewWaterEntry) {
      const batch = writeBatch(db);
      batch.set(doc(entries), {
        day: entry.day,
        ml: entry.ml,
        createdAt: Timestamp.fromDate(entry.createdAt),
        deletedAt: null,
      });
      moveDayTotal(batch, entry.day, entry.ml);
      return batch.commit();
    },

    remove(entry: WaterEntry) {
      const batch = writeBatch(db);
      batch.update(doc(entries, entry.id), { deletedAt: Timestamp.now() });
      moveDayTotal(batch, entry.day, -entry.ml);
      return batch.commit();
    },

    observeDay(day, onNext, onError) {
      return onSnapshot(
        query(entries, where('day', '==', day)),
        (snapshot) =>
          onNext(
            snapshot.docs
              .filter((d) => d.data().deletedAt === null)
              .map((d) => ({ id: d.id, day, ml: d.data().ml, createdAt: d.data().createdAt.toDate() })),
          ),
        onError,
      );
    },
  };
}
