import { inMemoryMilestoneRepository, inMemoryPlanRepository, inMemoryWorkoutRepository, trainingUseCases } from '@/modules/training';
import type { DayFacts } from '../domain/metric';
import { trainingFactsSource } from './trainingFactsSource';

const clock = { now: () => new Date('2026-11-03T10:00:00Z') };

test('sums reps × kg and counts the workouts of each day, within the range', async () => {
  const milestones = inMemoryMilestoneRepository();
  const workouts = inMemoryWorkoutRepository(milestones);
  const training = trainingUseCases({ plans: inMemoryPlanRepository(), workouts, milestones, clock, timezone: 'Europe/Paris' });
  const log = (day: string, sets: { reps: number; kg: number }[]) => ({
    day,
    planId: 'p1',
    sessionName: 'A',
    exerciseIds: ['squat'],
    sets: sets.map((s, i) => ({ exerciseId: 'squat', setNo: i + 1, ...s })),
    durationMin: 40,
    createdAt: new Date(`${day}T10:00:00Z`),
  });
  await workouts.add(log('2026-11-02', [{ reps: 8, kg: 20 }, { reps: 8, kg: 20 }]));
  await workouts.add(log('2026-11-02', [{ reps: 10, kg: 0 }])); // body weight: no volume
  await workouts.add(log('2026-11-09', [{ reps: 8, kg: 50 }])); // out of the range

  let seen = new Map<string, DayFacts>();
  trainingFactsSource(training).observeRange('2026-11-01', '2026-11-08', (facts) => (seen = facts), () => {});
  expect([...seen]).toEqual([['2026-11-02', { volumeKg: 320, sessions: 2 }]]);
});
