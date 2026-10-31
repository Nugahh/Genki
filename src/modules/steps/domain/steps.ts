/** An app that wrote steps to Health Connect, with the time of its last data when known. */
export type StepsSource = { origin: string; lastDataAt?: Date };
export type DaySteps = { steps: number; origins: string[] };

/** The package of the Fitbit app on Android. Steps counted by the phone itself have a synthetic origin since June 2026: never filter on `android`. */
export const FITBIT_PACKAGE = 'com.fitbit.FitbitMobile';
export const isFitbit = (origin: string) => origin === FITBIT_PACKAGE;

/** The source stored with a day's steps: the Fitbit when it wrote some, else the phone (or whatever app counted). */
export type StoredSource = 'fitbit' | 'phone';
export const storedSource = (origins: string[]): StoredSource => (origins.some(isFitbit) ? 'fitbit' : 'phone');
export const sourceLabel = (source: string | undefined) => (source === 'fitbit' ? 'Fitbit' : source === 'phone' ? 'Ce téléphone' : undefined);

const KNOWN_APPS: Record<string, string> = {
  [FITBIT_PACKAGE]: 'Fitbit',
  'com.google.android.apps.fitness': 'Google Fit',
  'com.sec.android.app.shealth': 'Samsung Health',
  'com.google.android.apps.healthdata': 'Health Connect',
};
/** A name for an origin: the app's when it is a known one, else the package itself. */
export const originName = (origin: string) => KNOWN_APPS[origin] ?? origin;

/** The state of the Fitbit line of Réglages › Pas (spec §7): no permission yet, the Fitbit seen among the sources, or the phone counting. */
export type FitbitStatus = 'no-permission' | 'detected' | 'phone-counts';
export function fitbitStatus(sources: StepsSource[], permissionGranted: boolean): FitbitStatus {
  if (!permissionGranted) return 'no-permission';
  return sources.some((s) => isFitbit(s.origin)) ? 'detected' : 'phone-counts';
}

/** Whether the steps read differ from the ones last written for the day (nothing written yet is a change). */
export const stepsChanged = (written: number | undefined, read: number) => written === undefined || written !== read;
