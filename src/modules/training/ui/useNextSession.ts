import { useEffect, useState } from 'react';
import { dayKey, type Clock } from '@/shared/clock';
import { useNow } from '@/shared/useNow';
import type { TrainingUseCases } from '../application/trainingUseCases';
import { nextSession, planPosition, type Plan } from '../domain/plan';
import type { WorkoutLog } from '../domain/workout';

export type NextSession = { title: string; subtitle: string; /** Its index in the phase in progress, as the workout route takes it. */ index: number };

/** The session to do next in the programme in progress, or undefined with no programme or once it is over. */
export function useNextSession(training: TrainingUseCases, clock: Clock, timezone: string): NextSession | undefined {
  const day = dayKey(useNow(clock), timezone);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [latest, setLatest] = useState<WorkoutLog | undefined>();
  // Listener errors show on the SyncIcon, which watches the same user's data.
  useEffect(() => training.observePlans(setPlans, () => {}), [training]);
  useEffect(() => training.observeLatestWorkout(setLatest, () => {}), [training]);

  const plan = plans.find((p) => p.active);
  if (!plan) return undefined;
  const position = planPosition(plan, day);
  if ('finished' in position) return undefined;
  const phase = plan.phases[position.phaseIndex];
  const session = nextSession(phase, latest?.sessionName);
  return {
    title: session.name,
    subtitle: `Phase ${position.phaseIndex + 1} — ${phase.name} · semaine ${position.week} sur ${phase.weeks}`,
    index: phase.sessions.indexOf(session),
  };
}
