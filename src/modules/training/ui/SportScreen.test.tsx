import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import { PaperProvider } from 'react-native-paper';
import { DEFAULT_PROFILE } from '@/modules/settings';
import { theme } from '@/theme';
import { inMemoryMilestoneRepository } from '../adapters/inMemoryMilestoneRepository';
import { inMemoryPlanRepository } from '../adapters/inMemoryPlanRepository';
import { inMemoryWorkoutRepository } from '../adapters/inMemoryWorkoutRepository';
import { trainingUseCases } from '../application/trainingUseCases';
import { starterPlan } from '../domain/template';
import { SportScreen } from './SportScreen';

const clock = { now: () => new Date('2026-11-03T10:00:00Z') }; // 11:00 in Paris, the 3rd of November

async function setup({ startDay }: { startDay?: string } = {}) {
  const plans = inMemoryPlanRepository();
  const workouts = inMemoryWorkoutRepository();
  const milestones = inMemoryMilestoneRepository();
  const training = trainingUseCases({ plans, workouts, milestones, clock, timezone: DEFAULT_PROFILE.timezone });
  if (startDay) await plans.create(starterPlan(startDay));
  const onStart = jest.fn();
  const onEditPlan = jest.fn();
  await render(
    <PaperProvider theme={theme}>
      <SportScreen profile={DEFAULT_PROFILE} clock={clock} training={training} run={(write) => void write()} onStart={onStart} onEditPlan={onEditPlan} />
    </PaperProvider>,
  );
  return { plans, workouts, milestones, training, onStart, onEditPlan };
}

describe('with no programme', () => {
  test('offers the starter programme, with the reminder to ask a professional first', async () => {
    await setup();
    expect(screen.getByText('Aucun programme')).toBeTruthy();
    expect(screen.getByText(/Consulte un professionnel avant de reprendre une activité intense/)).toBeTruthy();
  });

  test('« Partir du modèle » creates the programme and shows its phase and its sessions', async () => {
    const { plans } = await setup();
    await fireEvent.press(screen.getByText('Partir du modèle'));
    expect(plans.plans).toHaveLength(1);
    expect(screen.getByText('Reprise progressive')).toBeTruthy();
    expect(screen.getByText('Phase 1 — Reprise · semaine 1 sur 4')).toBeTruthy();
    expect(screen.getAllByText(/^Séance [ABC] — /)).toHaveLength(3);
    expect(screen.queryByText('Aucun programme')).toBeNull();
  });
});

describe('with a programme', () => {
  test.each([
    ['2026-11-03', 'Phase 1 — Reprise · semaine 1 sur 4'],
    ['2026-10-12', 'Phase 1 — Reprise · semaine 4 sur 4'],
    ['2026-09-01', 'Phase 2 — Construction · semaine 6 sur 6'], // 9 weeks later: 4 of the first phase, then the 6th of the second
  ])('started on %s, it is at « %s »', async (startDay, position) => {
    await setup({ startDay });
    expect(screen.getByText(position)).toBeTruthy();
  });

  test('is finished after its last week: no session to start, and the template to start again', async () => {
    await setup({ startDay: '2026-01-01' });
    expect(screen.getByText('Programme terminé')).toBeTruthy();
    expect(screen.queryByText('Démarrer')).toBeNull();
    expect(screen.getByText('Repartir du modèle')).toBeTruthy();
  });

  test('marks the next session, and starts the one touched', async () => {
    const { onStart } = await setup({ startDay: '2026-11-03' });
    expect(screen.getAllByText('Prochaine')).toHaveLength(1);
    const second = screen.getByLabelText('Démarrer Séance B — Bas du corps');
    await fireEvent.press(second);
    expect(onStart).toHaveBeenCalledWith(1);
  });

  test('follows the last workout: after session A, B comes next', async () => {
    const { workouts } = await setup({ startDay: '2026-11-03' });
    expect(within(screen.getByTestId('session-0')).queryByText('Prochaine')).toBeTruthy();
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
    expect(within(screen.getByTestId('session-1')).queryByText('Prochaine')).toBeTruthy();
    expect(within(screen.getByTestId('session-0')).queryByText('Prochaine')).toBeNull();
  });

  test('opens the editor', async () => {
    const { onEditPlan } = await setup({ startDay: '2026-11-03' });
    await fireEvent.press(screen.getByText('Modifier le programme'));
    expect(onEditPlan).toHaveBeenCalledTimes(1);
  });

  test('asks before starting again from the template, and « Annuler » keeps the programme', async () => {
    const { plans } = await setup({ startDay: '2026-10-12' });
    await fireEvent.press(screen.getByText('Repartir du modèle'));
    expect(screen.getByText('Remplacer le programme ?')).toBeTruthy();
    await fireEvent.press(screen.getByText('Annuler'));
    expect(plans.plans[0].startDay).toBe('2026-10-12');

    await fireEvent.press(screen.getByText('Repartir du modèle'));
    await fireEvent.press(screen.getByText('Remplacer'));
    expect(plans.plans).toHaveLength(1);
    expect(plans.plans[0].startDay).toBe('2026-11-03');
    expect(screen.getByText('Phase 1 — Reprise · semaine 1 sur 4')).toBeTruthy();
  });
});

describe('milestones', () => {
  test('adds one on an exercise of the programme, lists it as to reach, and deletes it after a confirmation', async () => {
    const { milestones } = await setup({ startDay: '2026-11-03' });
    expect(screen.getByText('Aucun palier pour l’instant.')).toBeTruthy();

    await fireEvent.press(screen.getByText('Ajouter un palier'));
    await fireEvent.press(screen.getByText('Squat gobelet'));
    expect(screen.getByText('Ajouter')).toBeDisabled();
    await fireEvent.changeText(screen.getByLabelText('Cible'), '40');
    await fireEvent.press(screen.getByText('Charge (kg)'));
    await fireEvent.press(screen.getByText('Ajouter'));

    expect(milestones.milestones).toEqual([{ id: '1', metric: 'exercise:squat-gobelet:kg', target: 40, direction: 'up', label: 'Squat gobelet : 40 kg' }]);
    expect(screen.getByText('Squat gobelet : 40 kg')).toBeTruthy();
    expect(screen.getByText('À atteindre')).toBeTruthy();

    await fireEvent.press(screen.getByLabelText('Supprimer le palier Squat gobelet : 40 kg'));
    expect(screen.getByText('Supprimer le palier Squat gobelet : 40 kg ?')).toBeTruthy();
    await fireEvent.press(screen.getByText('Supprimer'));
    expect(milestones.milestones).toEqual([]);
  });

  test('shows the date a milestone was reached', async () => {
    const { milestones } = await setup({ startDay: '2026-11-03' });
    await act(async () => {
      await milestones.create({ metric: 'exercise:tractions:reps', target: 10, direction: 'up', label: 'Tractions : 10 répétitions' });
      await milestones.markAchieved('1', new Date('2026-11-03T10:00:00Z'));
    });
    expect(screen.getByText('Atteint le 3 nov.')).toBeTruthy();
  });

  test('refuses a target out of range with a message that is announced', async () => {
    await setup({ startDay: '2026-11-03' });
    await fireEvent.press(screen.getByText('Ajouter un palier'));
    await fireEvent.press(screen.getByText('Squat gobelet'));
    await fireEvent.changeText(screen.getByLabelText('Cible'), '200000');
    expect(screen.getByText('Ajouter')).toBeDisabled();
    expect(screen.getByText('La cible est comprise entre 0 et 100 000.').props.accessibilityLiveRegion).toBe('polite');
  });
});
