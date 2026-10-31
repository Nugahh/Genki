import { collection, deleteDoc, doc, onSnapshot, query, setDoc, Timestamp, where, type Firestore, type QueryDocumentSnapshot } from '@react-native-firebase/firestore';
import type { CravingRepository } from '../application/ports';
import type { Craving } from '../domain/tobacco';

const cravingOf = (d: QueryDocumentSnapshot): Craving => {
  const data = d.data();
  return { id: d.id, day: data.day, createdAt: data.createdAt.toDate(), resisted: data.resisted === true };
};

/** The cravings in `users/{uid}/cravings`: written once as they happen, taken back only by a mis-tap. */
export function firestoreCravingRepository(db: Firestore, uid: string): CravingRepository {
  const cravings = collection(db, 'users', uid, 'cravings');

  return {
    add(craving) {
      const ref = doc(cravings);
      return { id: ref.id, saved: setDoc(ref, { day: craving.day, createdAt: Timestamp.fromDate(craving.createdAt), resisted: craving.resisted }) };
    },
    remove: (id) => deleteDoc(doc(cravings, id)),
    // A range on one field needs no composite index.
    observeBetween(from, to, onNext, onError) {
      return onSnapshot(query(cravings, where('day', '>=', from), where('day', '<=', to)), (snapshot) => onNext(snapshot.docs.map(cravingOf)), onError);
    },
  };
}
