import { deleteField, doc, onSnapshot, setDoc, Timestamp, type Firestore } from '@react-native-firebase/firestore';
import type { ProfilePatch, ProfileRepository, StoredProfile } from '../application/ports';

const PERIODS = ['day', 'week', 'year'];
const num = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? value : undefined);
const text = (value: unknown) => (typeof value === 'string' ? value : undefined);
// The rules take any short text as a time zone; a name Intl does not know would break every date of the app.
const zone = (value: unknown) => {
  if (typeof value !== 'string') return undefined;
  try {
    new Intl.DateTimeFormat('en-GB', { timeZone: value });
    return value;
  } catch {
    return undefined;
  }
};
const oneOf = <T extends string>(value: unknown, allowed: readonly T[]) => (allowed.includes(value as T) ? (value as T) : undefined);

/** The stored fields we trust, by type: a field of another shape is left out and the default shows. */
function storedOf(data: Record<string, any> | undefined): StoredProfile {
  if (!data) return {};
  const goals = data.goals ?? {};
  const fields = {
    timezone: zone(data.timezone),
    sex: oneOf(data.sex, ['male', 'female'] as const),
    birthYear: num(data.birthYear),
    heightCm: num(data.heightCm),
    activityLevel: oneOf(data.activityLevel, ['sedentary', 'light', 'active'] as const),
    goalMode: oneOf(data.goalMode, ['deficit', 'maintenance', 'surplus'] as const),
    weeklyLossKg: num(data.weeklyLossKg),
    quitDate: text(data.quitDate),
    cigarettesPerDay: num(data.cigarettesPerDay),
    packSize: num(data.packSize),
    packPrice: num(data.packPrice),
    waterContainers: Array.isArray(data.waterContainers)
      ? data.waterContainers.filter((c: any) => typeof c?.label === 'string' && num(c?.ml) !== undefined).map((c: any) => ({ label: c.label, ml: c.ml }))
      : undefined,
    createdAt: data.createdAt?.toDate?.() as Date | undefined,
    goals: { kcal: num(goals.kcal), proteinG: num(goals.proteinG), waterMl: num(goals.waterMl), steps: num(goals.steps) },
  };
  const defined = (o: object) => Object.fromEntries(Object.entries(o).filter(([, value]) => value !== undefined));
  return { ...defined(fields), goals: defined(fields.goals) } as StoredProfile;
}

/** The profile document `users/{uid}`: the profile fields of spec §4, and the display preferences in `ui`. */
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
    saveUi: (ui) => setDoc(profile, { ui }, { merge: true }),

    observeProfile(onNext, onError) {
      // A document that is not in the cache says nothing about the server's: it is not « nothing stored ».
      return onSnapshot(profile, (snapshot) => onNext(storedOf(snapshot.data()), snapshot.exists() || !snapshot.metadata.fromCache), onError);
    },
    saveProfile(patch: ProfilePatch) {
      const data: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(patch)) {
        if (value === undefined) continue;
        data[key] = value === null ? deleteField() : value instanceof Date ? Timestamp.fromDate(value) : value;
      }
      return setDoc(profile, data, { merge: true });
    },
  };
}
