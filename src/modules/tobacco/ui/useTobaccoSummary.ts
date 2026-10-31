import { useEffect, useState } from 'react';
import { dayKey, type Clock } from '@/shared/clock';
import { useNow } from '@/shared/useNow';
import type { QuitProfile, TobaccoSummary, TobaccoUseCases } from '../application/tobaccoUseCases';

/** The days without tobacco, the record and the money kept, live; null until read. It moves on to the new day by itself. */
export function useTobaccoSummary(tobacco: TobaccoUseCases, profile: QuitProfile, clock: Clock, timezone: string): TobaccoSummary | null {
  const day = dayKey(useNow(clock), timezone);
  const { quitDate, cigarettesPerDay, packPrice, packSize } = profile;
  const request = `${day}|${quitDate}|${cigarettesPerDay}|${packPrice}|${packSize}`;
  // The summary keeps its request, so that one for another quit date or day is never shown for this one.
  const [read, setRead] = useState<{ request: string; summary: TobaccoSummary } | null>(null);
  // Listener errors show on the SyncIcon, which watches the same user's data.
  useEffect(
    () => tobacco.observeSummary({ quitDate, cigarettesPerDay, packPrice, packSize }, (summary) => setRead({ request, summary }), () => {}),
    [tobacco, quitDate, cigarettesPerDay, packPrice, packSize, request],
  );
  return read?.request === request ? read.summary : null;
}
