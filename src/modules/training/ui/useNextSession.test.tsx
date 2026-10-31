import { act, renderHook } from '@testing-library/react-native';
import { inMemoryMilestoneRepository } from '../adapters/inMemoryMilestoneRepository';
import { inMemoryPlanRepository } from '../adapters/inMemoryPlanRepository';
import { inMemoryWorkoutRepository } from '../adapters/inMemoryWorkoutRepository';
import { trainingUseCases } from '../application/trainingUseCases';
import { starterPlan } from '../domain/template';
import { useNextSession } from './useNextSession';

const clock = { now: () => new Date('2026-11-03T10:00:00Z') };

function setup() {
  const plans = inMemoryPlanRepository();
  const workouts = inMemoryWorkoutRepository();
  const training = trainingUseCases({ plans, workouts, milestones: inMemoryMilestoneRepository(), clock, timezone: 'Europe/Paris' });
  return { plans, workouts, training };
}

test('is undefined with no programme', async () => {
  const { training } = setup();
  const { result } = await renderHook(() => useNextSession(training, clock, 'Europe/Paris'));
  expect(result.current).toBeUndefined();
});

test('is the first session of the phase in progress when none was done, with the phase and week', async () => {
  const { plans, training } = setup();
  await plans.create(starterPlan('2026-11-03'));
  const { result } = await renderHook(() => useNextSession(training, clock, 'Europe/Paris'));
  expect(result.current).toEqual({ title: 'Séance A — Haut du corps', subtitle: 'Phase 1 — Reprise · semaine 1 sur 4', index: 0 });
});

test('moves on to the next session once a workout is recorded', async () => {
  const { plans, workouts, training } = setup();
  await plans.create(starterPlan('2026-11-03'));
  const { result } = await renderHook(() => useNextSession(training, clock, 'Europe/Paris'));
  await act(async () => {
    await workouts.add({
      day: '2026-11-03',
      planId: '1',
      sessionName: 'Séance A — Haut du corps',
      exerciseIds: ['pompes'],
      sets: [{ exerciseId: 'pompes', setNo: 1, reps: 8, kg: 0 }],
      durationMin: 40,
      createdAt: new Date('2026-11-03T09:00:00Z'),
    });
  });
  expect(result.current).toMatchObject({ title: 'Séance B — Bas du corps', index: 1 });
});

test('is undefined once the programme is over', async () => {
  const { plans, training } = setup();
  await plans.create(starterPlan('2026-01-01'));
  const { result } = await renderHook(() => useNextSession(training, clock, 'Europe/Paris'));
  expect(result.current).toBeUndefined();
});
