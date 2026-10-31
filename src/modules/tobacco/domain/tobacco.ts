export type Craving = { id: string; day: string; createdAt: Date; /** True when the craving was resisted; false when a cigarette was smoked. */ resisted: boolean };
export type NewCraving = Omit<Craving, 'id'>;

export type Streaks = {
  /** Days since the last cigarette. */
  current: number;
  /** The longest run of days without one, the current one included. */
  record: number;
  /** Days since the quit date on which no cigarette was smoked. */
  smokeFreeDays: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;
const daysBetween = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS);

/**
 * The streaks from the quit date (the day of the last cigarette) and the days a cigarette was smoked after it (spec §9). A relapse restarts
 * the current streak at the day it happened and keeps the record; two on one day are one; a quit date to come, or none, is zero.
 */
export function streaks(quitDate: string | undefined, relapseDays: string[], today: string): Streaks {
  if (!quitDate || quitDate > today) return { current: 0, record: 0, smokeFreeDays: 0 };
  const relapses = [...new Set(relapseDays.filter((day) => day > quitDate && day <= today))].sort();
  // The days of a cigarette, from the quit date on: each run between two of them (and the one up to today) is a streak.
  const marks = [quitDate, ...relapses, today];
  let record = 0;
  for (let i = 1; i < marks.length; i++) record = Math.max(record, daysBetween(marks[i - 1], marks[i]));
  return { current: daysBetween(marks[marks.length - 2], today), record, smokeFreeDays: daysBetween(quitDate, today) - relapses.length };
}

/** What the cigarettes not smoked would have cost (spec §9); nothing while the number a day or the price is not given. */
export function savings(smokeFreeDays: number, input: { cigarettesPerDay?: number; packPrice?: number; packSize: number }): number | undefined {
  if (input.cigarettesPerDay === undefined || input.packPrice === undefined || input.packSize <= 0) return undefined;
  return (smokeFreeDays * input.cigarettesPerDay * input.packPrice) / input.packSize;
}
