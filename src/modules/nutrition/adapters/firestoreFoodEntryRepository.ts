import {
  collection, doc, increment, limit, onSnapshot, orderBy, query, serverTimestamp, Timestamp, where, writeBatch,
  type Firestore, type QueryDocumentSnapshot, type WriteBatch,
} from '@react-native-firebase/firestore';
import type { FoodEntryRepository } from '../application/ports';
import type { FoodEntry } from '../domain/food';
import { subtractMacros, ZERO_MACROS, type Macros } from '../domain/macros';

/** Entries in `users/{uid}/foodEntries`; each write moves `days/{day}` in the same batch (spec §4). */
export function firestoreFoodEntryRepository(db: Firestore, uid: string): FoodEntryRepository {
  const entries = collection(db, 'users', uid, 'foodEntries');

  // increment() adds up on the server: entries logged offline on two phones sum instead of overwriting.
  const moveDayTotals = (batch: WriteBatch, day: string, m: Macros) =>
    batch.set(
      doc(db, 'users', uid, 'days', day),
      { kcal: increment(m.kcal), proteinG: increment(m.protein), carbsG: increment(m.carbs), fatG: increment(m.fat), updatedAt: serverTimestamp() },
      { merge: true },
    );

  const toEntry = (d: QueryDocumentSnapshot): FoodEntry => {
    const data = d.data();
    return { id: d.id, day: data.day, meal: data.meal, foodRef: data.foodRef, foodName: data.foodName, grams: data.grams, macros: data.macros, createdAt: data.createdAt.toDate() };
  };
  const live = (docs: QueryDocumentSnapshot[]) => docs.filter((d) => d.data().deletedAt === null).map(toEntry);

  return {
    add(entry) {
      const batch = writeBatch(db);
      const at = Timestamp.fromDate(entry.createdAt);
      batch.set(doc(entries), {
        day: entry.day, meal: entry.meal, foodRef: entry.foodRef, foodName: entry.foodName,
        grams: entry.grams, macros: entry.macros, createdAt: at, updatedAt: at, deletedAt: null,
      });
      // Rounded like the other two writes, so that adding then removing an entry always nets to zero.
      moveDayTotals(batch, entry.day, subtractMacros(entry.macros, ZERO_MACROS));
      return batch.commit();
    },
    updateGrams(entry, grams, macros) {
      const batch = writeBatch(db);
      batch.update(doc(entries, entry.id), { grams, macros, updatedAt: Timestamp.now() });
      moveDayTotals(batch, entry.day, subtractMacros(macros, entry.macros));
      return batch.commit();
    },
    remove(entry) {
      const batch = writeBatch(db);
      // Timestamp.now(), not serverTimestamp(): a pending server timestamp reads as null and the entry would stay listed offline.
      batch.update(doc(entries, entry.id), { deletedAt: Timestamp.now() });
      moveDayTotals(batch, entry.day, subtractMacros(ZERO_MACROS, entry.macros));
      return batch.commit();
    },
    observeDay(day, onNext, onError) {
      return onSnapshot(query(entries, where('day', '==', day)), (snapshot) => onNext(live(snapshot.docs)), onError);
    },
    observeRecent(max, onNext, onError) {
      return onSnapshot(query(entries, orderBy('createdAt', 'desc'), limit(max)), (snapshot) => onNext(live(snapshot.docs)), onError);
    },
  };
}
