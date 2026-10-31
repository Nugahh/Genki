import { doc, onSnapshot, setDoc, type Firestore } from '@react-native-firebase/firestore';
import type { ProfileRepository } from '../application/ports';
import type { UiPrefs } from '../domain/ui';

/** The profile document `users/{uid}`; so far it holds the display preferences, in `ui`. */
export function firestoreProfileRepository(db: Firestore, uid: string): ProfileRepository {
  const profile = doc(db, 'users', uid);

  return {
    observeUi(onNext, onError) {
      return onSnapshot(
        profile,
        (snapshot) => {
          const ui = snapshot.data()?.ui;
          onNext({ ...(Array.isArray(ui?.hubMetrics) && { hubMetrics: ui.hubMetrics }), ...(typeof ui?.period === 'string' && { period: ui.period }) });
        },
        onError,
      );
    },
    // Firestore refuses undefined values, and a merge keeps the fields that are not given.
    saveUi: (ui: UiPrefs) => setDoc(profile, { ui: Object.fromEntries(Object.entries(ui).filter(([, value]) => value !== undefined)) }, { merge: true }),
  };
}
