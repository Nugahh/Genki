import { useMemo } from 'react';
import type { Goals } from '../domain/metric';

/** The goals as one object for as long as their values stay: every profile snapshot builds a new object, which must not restart a listener. */
export function useStableGoals(goals: Goals): Goals {
  const key = JSON.stringify(goals);
  return useMemo(() => JSON.parse(key) as Goals, [key]);
}
