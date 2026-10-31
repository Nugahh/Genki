import { collection, documentId, onSnapshot, query, where, type Firestore } from '@react-native-firebase/firestore';
import type { FactsSource } from '../application/ports';
import type { DayFacts } from '../domain/metric';

const finite = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? value : undefined);
// A total that is back to 0 (a meal or a glass taken back) is a day with no record, not a day at 0. Sums of 0.1-rounded floats
// drift a hair either side of 0 (the rules allow -0.05): below the same 0.05 it is 0.
const total = (value: unknown) => {
  const n = finite(value);
  return n !== undefined && n >= 0.05 ? n : undefined;
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
            const day: DayFacts = {
              waterMl: total(data.waterMl),
              kcal: total(data.kcal),
              proteinG: total(data.proteinG),
              carbsG: total(data.carbsG),
              fatG: total(data.fatG),
              steps: total(data.steps),
              weightKg: finite(data.weightKg),
              waistCm: finite(data.waistCm),
            };
            // A field with no record is left out, not set to undefined.
            facts.set(d.id, Object.fromEntries(Object.entries(day).filter(([, value]) => value !== undefined)));
          }
          onNext(facts);
        },
        onError,
      );
    },
  };
}
