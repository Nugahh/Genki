import { useEffect, useState } from 'react';
import { dayKey, type Clock } from '@/shared/clock';
import { useNow } from '@/shared/useNow';
import type { BodySummary, BodyUseCases } from '../application/bodyUseCases';

/** The measures of today and the mean of the last seven days, live; null until read. It moves on to the new day by itself. */
export function useBodySummary(body: BodyUseCases, clock: Clock, timezone: string): BodySummary | null {
  const day = dayKey(useNow(clock), timezone);
  // The summary keeps its day, so that yesterday's is never shown as today's.
  const [read, setRead] = useState<{ day: string; summary: BodySummary } | null>(null);
  // Listener errors show on the SyncIcon, which watches the same user's data.
  useEffect(() => body.observeSummary(day, (summary) => setRead({ day, summary }), () => {}), [body, day]);
  return read?.day === day ? read.summary : null;
}
