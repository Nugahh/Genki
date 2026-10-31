export interface Clock {
  now(): Date;
}

export const systemClock: Clock = { now: () => new Date() };

function partsIn(timeZone: string, date: Date): Record<string, string> {
  // en-GB is 24-hour by default, in case an engine (Hermes) ignores hourCycle.
  const format = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  return Object.fromEntries(format.formatToParts(date).map((p) => [p.type, p.value]));
}

/** `YYYY-MM-DD` of `date` in the profile's time zone, never the phone's (spec §4 rule 4). */
export function dayKey(date: Date, timeZone: string): string {
  const p = partsIn(timeZone, date);
  return `${p.year}-${p.month}-${p.day}`;
}

/** Hour of `date` in `timeZone`, minutes as a fraction: 14:30 → 14.5. */
export function hourOfDay(date: Date, timeZone: string): number {
  const p = partsIn(timeZone, date);
  // Some engines print midnight as "24" even with h23.
  return (Number(p.hour) % 24) + Number(p.minute) / 60;
}

const DAY_MS = 24 * 60 * 60 * 1000;
/** The day `n` days after (or before, if negative) a day key: calendar arithmetic, with no time zone or clock change in it. */
export const addDays = (day: string, n: number) => new Date(Date.parse(`${day}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);

/**
 * The instants a day of the profile's time zone starts and ends at: midnight to midnight, `end` excluded. A day is 23 or 25 hours long
 * the day the clocks change. Found by bisection on `dayKey`, which reads the zone's own rules.
 */
export function dayBounds(day: string, timezone: string): { start: Date; end: Date } {
  const firstInstantOf = (target: string) => {
    // Offsets of a zone stay within ±14 h of UTC: the first instant of `target` lies in this window.
    let low = Date.parse(`${target}T00:00:00Z`) - 15 * 3600_000;
    let high = Date.parse(`${target}T00:00:00Z`) + 15 * 3600_000;
    while (high - low > 1000) {
      const mid = Math.floor((low + high) / 2000) * 1000;
      if (dayKey(new Date(mid), timezone) >= target) high = mid;
      else low = mid;
    }
    return new Date(high);
  };
  return { start: firstInstantOf(day), end: firstInstantOf(addDays(day, 1)) };
}
