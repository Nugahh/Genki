import { doc, onSnapshot, setDoc, type Firestore } from '@react-native-firebase/firestore';
import type { ProfileRepository } from '../application/ports';
import type { UiPrefs } from '../domain/ui';

const PERIODS = ['day', 'week', 'year'];

/** The profile document `users/{uid}`; so far it holds the display preferences, in `ui`. */
export function firestoreProfileRepository(db: Firestore, uid: string): ProfileRepository {
  const profile = doc(db, 'users', uid);

  return {
    observeUi(onNext, onError) {
      return onSnapshot(
        profile,
        (snapshot) => {
          const ui = snapshot.data()?.ui;
          onNext({ ...(Array.isArray(ui?.hubMetrics) && { hubMetrics: ui.hubMetrics }), ...(PERIODS.includes(ui?.period) && { period: ui.period }) });
        },
        onError,
      );
    },
    // A merge keeps the fields that are not given.
    saveUi: (ui: UiPrefs) => setDoc(profile, { ui }, { merge: true }),
  };
}
