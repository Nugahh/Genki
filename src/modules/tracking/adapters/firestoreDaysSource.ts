import { collection, documentId, onSnapshot, query, where, type Firestore } from '@react-native-firebase/firestore';
import type { FactsSource } from '../application/ports';
import type { DayFacts } from '../domain/metric';

const finite = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? value : undefined);
// A total that is back to 0 (a meal or a glass taken back) is a day with no record, not a day at 0.
const total = (value: unknown) => {
  const n = finite(value);
  return n !== undefined && n > 0 ? n : undefined;
};

/** The totals of `users/{uid}/days`: their id is the day, so a range of days is a range of ids. */
export function firestoreDaysSource(db: Firestore, uid: string): FactsSource {
  const days = collection(db, 'users', uid, 'days');

  return {
    observeRange(from, to, onNext, onError) {
      return onSnapshot(
        query(days, where(documentId(), '>=', from), where(documentId(), '<=', to)),
        (snapshot) => {
          const facts = new Map<string, DayFacts>();
          for (const d of snapshot.docs) {
            const data = d.data();
            facts.set(d.id, {
              waterMl: total(data.waterMl),
              kcal: total(data.kcal),
              proteinG: total(data.proteinG),
              carbsG: total(data.carbsG),
              fatG: total(data.fatG),
              steps: total(data.steps),
              weightKg: finite(data.weightKg),
              waistCm: finite(data.waistCm),
            });
          }
          onNext(facts);
        },
        onError,
      );
    },
  };
}
