import { act, render, screen } from '@testing-library/react-native';
import { PaperProvider } from 'react-native-paper';
import { DEFAULT_PROFILE } from '@/modules/settings';
import { theme } from '@/theme';
import { inMemoryMilestoneRepository } from '../adapters/inMemoryMilestoneRepository';
import { inMemoryPlanRepository } from '../adapters/inMemoryPlanRepository';
import { inMemoryWorkoutRepository } from '../adapters/inMemoryWorkoutRepository';
import { trainingUseCases } from '../application/trainingUseCases';
import { ExerciseHistoryScreen } from './ExerciseHistoryScreen';

const clock = { now: () => new Date('2026-11-10T10:00:00Z') };

async function setup(logs: { day: string; reps: number[]; kg: number }[]) {
  const workouts = inMemoryWorkoutRepository();
  const training = trainingUseCases({ plans: inMemoryPlanRepository(), workouts, milestones: inMemoryMilestoneRepository(), clock, timezone: DEFAULT_PROFILE.timezone });
  for (const log of logs) {
    await act(async () => {
      await workouts.add({
        day: log.day,
        planId: 'p1',
        sessionName: 'Séance A',
        exerciseIds: ['squat-gobelet', 'pompes'],
        sets: [
          ...log.reps.map((reps, i) => ({ exerciseId: 'squat-gobelet', setNo: i + 1, reps, kg: log.kg })),
          { exerciseId: 'pompes', setNo: 1, reps: 30, kg: 0 },
        ],
        durationMin: 40,
        createdAt: new Date(`${log.day}T10:00:00Z`),
      });
    });
  }
  await render(
    <PaperProvider theme={theme}>
      <ExerciseHistoryScreen training={training} exerciseId="squat-gobelet" name="Squat gobelet" />
    </PaperProvider>,
  );
}

test('lists the workouts that hold the exercise, newest first, with the sets of that exercise only', async () => {
  await setup([
    { day: '2026-11-03', reps: [8, 8, 8], kg: 20 },
    { day: '2026-11-10', reps: [8, 8, 6], kg: 22.5 },
  ]);
  expect(await screen.findByText('Squat gobelet')).toBeTruthy();
  const days = screen.getAllByTestId('history-day').map((n) => n.props.children);
  expect(days).toEqual(['mardi 10 novembre', 'mardi 3 novembre']);
  expect(screen.getByText('8 × 22,5 kg · 8 × 22,5 kg · 6 × 22,5 kg')).toBeTruthy();
  expect(screen.getByText('3 × 8 à 20 kg')).toBeTruthy();
  expect(screen.queryByText(/30/)).toBeNull(); // the push-ups of the same workouts are not shown
});

test('says so when the exercise has no workout yet', async () => {
  await setup([]);
  expect(await screen.findByText('Aucune séance pour cet exercice.')).toBeTruthy();
});
