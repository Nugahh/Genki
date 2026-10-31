import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { PaperProvider } from 'react-native-paper';
import { DEFAULT_PROFILE } from '@/modules/settings';
import { theme } from '@/theme';
import { inMemoryMilestoneRepository } from '../adapters/inMemoryMilestoneRepository';
import { inMemoryPlanRepository } from '../adapters/inMemoryPlanRepository';
import { inMemoryWorkoutRepository } from '../adapters/inMemoryWorkoutRepository';
import { trainingUseCases } from '../application/trainingUseCases';
import { starterPlan } from '../domain/template';
import { WorkoutScreen } from './WorkoutScreen';

const clock = { now: () => new Date('2026-11-03T10:00:00Z') };

async function setup({ withPlan = true }: { withPlan?: boolean } = {}) {
  const plans = inMemoryPlanRepository();
  const workouts = inMemoryWorkoutRepository();
  const milestones = inMemoryMilestoneRepository();
  const training = trainingUseCases({ plans, workouts, milestones, clock, timezone: DEFAULT_PROFILE.timezone });
  if (withPlan) await plans.create(starterPlan('2026-11-03'));
  const onDone = jest.fn();
  const onDirtyChange = jest.fn();
  await render(
    <PaperProvider theme={theme}>
      <WorkoutScreen profile={DEFAULT_PROFILE} clock={clock} training={training} sessionIndex={0} run={(write) => void write()} onDone={onDone} onDirtyChange={onDirtyChange} />
    </PaperProvider>,
  );
  return { plans, workouts, milestones, training, onDone, onDirtyChange };
}

// The first session of the starter programme: Pompes, Rowing haltère, Développé militaire haltères, Tractions assistées, Gainage planche (secondes).
const set = (exercise: string, n: number) => ({
  kg: () => screen.getByLabelText(`${exercise}, série ${n}, charge (kg)`),
  reps: () => screen.getByLabelText(`${exercise}, série ${n}, répétitions`),
  done: () => screen.getByLabelText(`${exercise}, série ${n} faite`),
});

describe('loading', () => {
  test('lists the exercises of the session, each with its planned sets', async () => {
    await setup();
    expect(await screen.findByText('Pompes')).toBeTruthy();
    expect(screen.getByText('Rowing haltère')).toBeTruthy();
    expect(screen.getAllByText('Première fois')).toHaveLength(5);
    for (const n of [1, 2, 3]) expect(set('Pompes', n).reps()).toHaveDisplayValue('8');
  });

  test('says there is nothing to start without a programme', async () => {
    await setup({ withPlan: false });
    expect(await screen.findByText('Aucune séance à démarrer.')).toBeTruthy();
  });
});

describe('with a workout done before', () => {
  test('prefills the load to aim for after a clean workout, and says what it was', async () => {
    const plans = inMemoryPlanRepository();
    const workouts = inMemoryWorkoutRepository();
    const training = trainingUseCases({ plans, workouts, milestones: inMemoryMilestoneRepository(), clock, timezone: DEFAULT_PROFILE.timezone });
    await plans.create(starterPlan('2026-11-03'));
    await workouts.add({
      day: '2026-10-30',
      planId: '1',
      sessionName: 'Séance A — Haut du corps',
      exerciseIds: ['rowing-haltere'],
      sets: [1, 2, 3].map((setNo) => ({ exerciseId: 'rowing-haltere', setNo, reps: 10, kg: 15 })),
      durationMin: 40,
      createdAt: new Date('2026-10-30T10:00:00Z'),
    });
    await render(
      <PaperProvider theme={theme}>
        <WorkoutScreen profile={DEFAULT_PROFILE} clock={clock} training={training} sessionIndex={0} run={(write) => void write()} onDone={() => {}} onDirtyChange={() => {}} />
      </PaperProvider>,
    );
    expect(await screen.findByText('Dernière fois : 3 × 10 à 15 kg')).toBeTruthy();
    expect(screen.getByText('À viser : 17,5 kg')).toBeTruthy();
    expect(set('Rowing haltère', 1).kg()).toHaveDisplayValue('17,5');
  });
});

describe('the rest timer', () => {
  test('starts when a set is ticked off, counts down, and can be skipped', async () => {
    await setup();
    await screen.findByText('Pompes');
    jest.useFakeTimers();
    try {
      await fireEvent.press(set('Pompes', 1).done());
      expect(screen.getByText('Repos 1:30')).toBeTruthy();
      await act(async () => {
        jest.advanceTimersByTime(3000);
      });
      expect(screen.getByText('Repos 1:27')).toBeTruthy();
      await fireEvent.press(screen.getByText('Passer'));
      expect(screen.queryByText(/^Repos /)).toBeNull();
    } finally {
      jest.useRealTimers();
    }
  });

  test('ends by itself', async () => {
    await setup();
    await screen.findByText('Pompes');
    jest.useFakeTimers();
    try {
      await fireEvent.press(set('Pompes', 1).done());
      await act(async () => {
        jest.advanceTimersByTime(91_000);
      });
      expect(screen.queryByText(/^Repos /)).toBeNull();
    } finally {
      jest.useRealTimers();
    }
  });
});

describe('finishing', () => {
  test('is not possible before a set is done', async () => {
    await setup();
    await screen.findByText('Pompes');
    expect(screen.getByText('Terminer')).toBeDisabled();
    await fireEvent.press(set('Pompes', 1).done());
    expect(screen.getByText('Terminer')).toBeEnabled();
    await fireEvent.press(set('Pompes', 1).done());
    expect(screen.getByText('Terminer')).toBeDisabled();
  });

  test('is refused for a value out of range, with a message that is announced', async () => {
    await setup();
    await screen.findByText('Pompes');
    await fireEvent.press(set('Pompes', 1).done());
    await fireEvent.changeText(set('Pompes', 1).kg(), '2000');
    expect(screen.getByText('Terminer')).toBeDisabled();
    expect(screen.getByText('La charge et les répétitions sont comprises entre 0 et 1 000.').props.accessibilityLiveRegion).toBe('polite');
    await fireEvent.changeText(set('Pompes', 1).kg(), '0');
    expect(screen.getByText('Terminer')).toBeEnabled();
  });

  test('ignores a set that is not ticked, even with an invalid value', async () => {
    await setup();
    await screen.findByText('Pompes');
    await fireEvent.press(set('Pompes', 1).done());
    await fireEvent.changeText(set('Pompes', 2).reps(), 'abc');
    expect(screen.getByText('Terminer')).toBeEnabled();
  });

  test('records the sets done, then says what the next time aims at and which milestone it reached', async () => {
    const { workouts, milestones, training, onDone } = await setup();
    await screen.findByText('Pompes');
    await training.addMilestone({ metric: 'exercise:rowing-haltere:kg', target: 10, direction: 'up', label: 'Rowing haltère : 10 kg' });
    for (const n of [1, 2, 3]) {
      await fireEvent.changeText(set('Rowing haltère', n).kg(), '10');
      await fireEvent.press(set('Rowing haltère', n).done());
    }
    await fireEvent.press(screen.getByText('Terminer'));

    expect(await screen.findByText('Séance enregistrée, bravo !')).toBeTruthy();
    expect(workouts.logs).toHaveLength(1);
    expect(workouts.logs[0]).toMatchObject({ sessionName: 'Séance A — Haut du corps', exerciseIds: ['rowing-haltere'], day: '2026-11-03' });
    expect(workouts.logs[0].sets).toEqual([1, 2, 3].map((setNo) => ({ exerciseId: 'rowing-haltere', setNo, reps: 10, kg: 10 })));
    expect(screen.getByText('Rowing haltère : 12,5 kg la prochaine fois')).toBeTruthy();
    expect(screen.getByText('Palier atteint : Rowing haltère : 10 kg')).toBeTruthy();
    expect(milestones.milestones[0].achievedAt).toBeTruthy();

    await fireEvent.press(screen.getByText('Retour'));
    expect(onDone).toHaveBeenCalledTimes(1);
  });
});

describe('leaving', () => {
  test('tells the host when there is something to lose', async () => {
    const { onDirtyChange } = await setup();
    await screen.findByText('Pompes');
    await fireEvent.press(set('Pompes', 1).done());
    expect(onDirtyChange).toHaveBeenLastCalledWith(true);
    await fireEvent.press(set('Pompes', 1).done());
    expect(onDirtyChange).toHaveBeenLastCalledWith(false);
  });
});
