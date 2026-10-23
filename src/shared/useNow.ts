import { useEffect, useState } from 'react';
import type { Clock } from './clock';

/** Current time, refreshed every minute so the day key and gauge paces follow the clock. */
export function useNow(clock: Clock): Date {
  const [now, setNow] = useState(() => clock.now());
  useEffect(() => {
    const id = setInterval(() => setNow(clock.now()), 60_000);
    return () => clearInterval(id);
  }, [clock]);
  return now;
}
