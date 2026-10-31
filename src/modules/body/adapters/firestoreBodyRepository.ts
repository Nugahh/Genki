import { collection, doc, documentId, onSnapshot, query, serverTimestamp, Timestamp, where, writeBatch, type Firestore } from '@react-native-firebase/firestore';
import type { BodyRepository } from '../application/ports';
import type { Measure } from '../domain/body';

const finite = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? value : undefined);

/** The weight and the waist of `users/{uid}/days/{date}`: one value a day each, merged into the document the totals live in. */
export function firestoreBodyRepository(db: Firestore, uid: string): BodyRepository {
  const days = collection(db, 'users', uid, 'days');
  const milestones = collection(db, 'users', uid, 'milestones');

  return {
    observeRecent(from, to, onNext, onError) {
      return onSnapshot(
        query(days, where(documentId(), '>=', from), where(documentId(), '<=', to)),
        (snapshot) => {
          const found = new Map<string, Measure>();
          for (const d of snapshot.docs) {
            const data = d.data();
            const measure = { weightKg: finite(data.weightKg), waistCm: finite(data.waistCm) };
            if (measure.weightKg !== undefined || measure.waistCm !== undefined) {
              found.set(d.id, Object.fromEntries(Object.entries(measure).filter(([, value]) => value !== undefined)));
            }
          }
          onNext(found);
        },
        onError,
      );
    },
    save(day, measure, reachedMilestoneIds, at) {
      const batch = writeBatch(db);
      batch.set(doc(days, day), { ...measure, updatedAt: serverTimestamp() }, { merge: true });
      for (const id of reachedMilestoneIds) batch.update(doc(milestones, id), { achievedAt: Timestamp.fromDate(at) });
      return batch.commit();
    },
  };
}
