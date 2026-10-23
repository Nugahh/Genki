export interface Clock {
  now(): Date;
}

export const systemClock: Clock = { now: () => new Date() };

function partsIn(timeZone: string, date: Date): Record<string, string> {
  const format = new Intl.DateTimeFormat('en-US', {
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
