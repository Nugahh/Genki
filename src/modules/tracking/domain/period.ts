export type Period = 'day' | 'week' | 'month' | 'year';
/** A stretch of days (inclusive, `YYYY-MM-DD` keys) drawn as one bar or one point. */
export type Bucket = {
  key: string;
  /** Short, for under a bar: « lun. », « janv. ». */
  label: string;
  /** Whole, for a screen reader: « lundi », « janvier ». */
  spoken: string;
  from: string;
  to: string;
};

const DAY_MS = 24 * 60 * 60 * 1000;
// Day keys are calendar days: UTC arithmetic has no time-zone or clock-change drift.
const toDate = (day: string) => new Date(`${day}T00:00:00Z`);
const toKey = (date: Date) => date.toISOString().slice(0, 10);

const WEEKDAYS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const WEEKDAYS_SHORT = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'];
const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const MONTHS_SHORT = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

export const addDays = (day: string, n: number) => toKey(new Date(toDate(day).getTime() + n * DAY_MS));

/** The Monday of the calendar week that holds `day` (a Sunday belongs to the week before). */
export const mondayOf = (day: string) => addDays(day, -((toDate(day).getUTCDay() + 6) % 7));

const lastDayOfMonth = (year: number, month: number) => toKey(new Date(Date.UTC(year, month + 1, 0)));

const dayBucket = (day: string): Bucket => {
  const weekday = toDate(day).getUTCDay();
  return { key: day, label: WEEKDAYS_SHORT[weekday], spoken: WEEKDAYS[weekday], from: day, to: day };
};

export function bucketsFor(period: Period, anchor: string): Bucket[] {
  if (period === 'day') return [dayBucket(anchor)];
  if (period === 'week') {
    const monday = mondayOf(anchor);
    return Array.from({ length: 7 }, (_, i) => dayBucket(addDays(monday, i)));
  }
  if (period === 'month') {
    const month = Number(anchor.slice(5, 7)) - 1;
    const days = Number(lastDayOfMonth(Number(anchor.slice(0, 4)), month).slice(8, 10));
    return Array.from({ length: days }, (_, i) => {
      const n = i + 1;
      const day = `${anchor.slice(0, 8)}${String(n).padStart(2, '0')}`;
      return { key: day, label: String(n), spoken: `${n === 1 ? '1er' : n} ${MONTHS[month]}`, from: day, to: day };
    });
  }
  const year = Number(anchor.slice(0, 4));
  return MONTHS_SHORT.map((label, month) => {
    const key = `${year}-${String(month + 1).padStart(2, '0')}`;
    return { key, label, spoken: MONTHS[month], from: `${key}-01`, to: lastDayOfMonth(year, month) };
  });
}

export const rangeOf = (buckets: Bucket[]) => ({ from: buckets[0].from, to: buckets[buckets.length - 1].to });

/** The same place one period earlier (-1) or later (1), clamped to the last day of a shorter month. */
export function shiftAnchor(period: Period, anchor: string, step: -1 | 1): string {
  if (period === 'day') return addDays(anchor, step);
  if (period === 'week') return addDays(anchor, 7 * step);
  // A month and a year both move whole months: 12 of them for a year.
  const index = Number(anchor.slice(0, 4)) * 12 + Number(anchor.slice(5, 7)) - 1 + (period === 'month' ? step : 12 * step);
  const year = Math.floor(index / 12);
  const month = index % 12;
  const last = Number(lastDayOfMonth(year, month).slice(8, 10));
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(Math.min(Number(anchor.slice(8, 10)), last)).padStart(2, '0')}`;
}

const shortDate = (day: string) => `${Number(day.slice(8, 10))} ${MONTHS_SHORT[Number(day.slice(5, 7)) - 1]}`;

export function periodTitle(period: Period, anchor: string): string {
  if (period === 'year') return anchor.slice(0, 4);
  if (period === 'month') return `${MONTHS[Number(anchor.slice(5, 7)) - 1]} ${anchor.slice(0, 4)}`;
  if (period === 'week') {
    const monday = mondayOf(anchor);
    return `Semaine du ${shortDate(monday)} au ${shortDate(addDays(monday, 6))}`;
  }
  return `${WEEKDAYS[toDate(anchor).getUTCDay()]} ${Number(anchor.slice(8, 10))} ${MONTHS[Number(anchor.slice(5, 7)) - 1]}`;
}
