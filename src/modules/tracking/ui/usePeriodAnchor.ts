import { useState } from 'react';
import { dayKey, type Clock } from '@/shared/clock';
import { useNow } from '@/shared/useNow';
import { bucketsFor, periodTitle, rangeOf, shiftAnchor, type Period } from '../domain/period';

/** Which period of its kind is shown: the one in progress (it follows the clock), or one reached with the arrows. */
export function usePeriodAnchor(period: Period, clock: Clock, timezone: string) {
  const today = dayKey(useNow(clock), timezone);
  // null is the period in progress: it follows the clock, so that a screen left open overnight moves on to the new day.
  const [picked, setPicked] = useState<string | null>(null);
  const anchor = picked ?? today;
  const canGoForward = rangeOf(bucketsFor(period, shiftAnchor(period, anchor, 1))).from <= today;
  const shift = (step: -1 | 1) => {
    const next = shiftAnchor(period, anchor, step);
    setPicked(rangeOf(bucketsFor(period, next)).to >= today ? null : next);
  };
  return { today, anchor, title: periodTitle(period, anchor), canGoForward, shift };
}
