import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import type { Clock } from './clock';

/** Current time, refreshed every minute so the day key and gauge paces follow the clock. */
export function useNow(clock: Clock): Date {
  const [now, setNow] = useState(() => clock.now());
  useEffect(() => {
    const id = setInterval(() => setNow(clock.now()), 60_000);
    // JS timers pause in the background: without this, Today could show yesterday for a minute after a resume.
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') setNow(clock.now());
    });
    return () => {
      clearInterval(id);
      subscription.remove();
    };
  }, [clock]);
  return now;
}
