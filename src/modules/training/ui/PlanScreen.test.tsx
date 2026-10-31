import { fireEvent, render, screen, within } from '@testing-library/react-native';
import { PaperProvider } from 'react-native-paper';
import { DEFAULT_PROFILE } from '@/modules/settings';
import { theme } from '@/theme';
import { inMemoryMilestoneRepository } from '../adapters/inMemoryMilestoneRepository';
import { inMemoryPlanRepository } from '../adapters/inMemoryPlanRepository';
import { inMemoryWorkoutRepository } from '../adapters/inMemoryWorkoutRepository';
import { trainingUseCases } from '../application/trainingUseCases';
import { starterPlan } from '../domain/template';
import { PlanScreen } from './PlanScreen';

const clock = { now: () => new Date('2026-11-03T10:00:00Z') };

async function setup(plan = starterPlan('2026-11-03')) {
  const plans = inMemoryPlanRepository();
  const training = trainingUseCases({ plans, workouts: inMemoryWorkoutRepository(), milestones: inMemoryMilestoneRepository(), clock, timezone: DEFAULT_PROFILE.timezone });
  await plans.create(plan);
  const onOpenHistory = jest.fn();
  await render(
    <PaperProvider theme={theme}>
      <PlanScreen training={training} run={(write) => void write()} onOpenHistory={onOpenHistory} />
    </PaperProvider>,
  );
  return { plans, onOpenHistory };
}

const row = (phase: number, session: number, exercise: number) => screen.getByTestId(`exercise-${phase}-${session}-${exercise}`);
const type = (label: string, text: string) => fireEvent.changeText(screen.getByLabelText(label), text);

test('lists the phases, the sessions and each exercise with its sets, reps and increment', async () => {
  await setup();
  expect(screen.getByText('Phase 1 — Reprise · 4 semaines')).toBeTruthy();
  expect(screen.getByText('Phase 3 — Force et explosivité · 6 semaines')).toBeTruthy();
  expect(within(row(0, 0, 0)).getByText('Pompes')).toBeTruthy();
  expect(within(row(0, 0, 0)).getByText('3 × 8')).toBeTruthy();
  expect(within(row(0, 0, 1)).getByText('Rowing haltère')).toBeTruthy();
  expect(within(row(0, 0, 1)).getByText('3 × 10 · +2,5 kg')).toBeTruthy();
});

test('changes an exercise, and its id follows its name', async () => {
  const { plans } = await setup();
  await fireEvent.press(row(0, 0, 0));
  expect(screen.getByText('Modifier l’exercice')).toBeTruthy();
  await type('Nom', 'Pompes diamant');
  await type('Séries', '4');
  await type('Répétitions', '12');
  await type('Incrément de charge (kg)', '1,25');
  await fireEvent.press(screen.getByText('Enregistrer'));

  expect(plans.plans[0].phases[0].sessions[0].exercises[0]).toEqual({ exerciseId: 'pompes-diamant', name: 'Pompes diamant', sets: 4, reps: 12, incrementKg: 1.25 });
  expect(within(row(0, 0, 0)).getByText('4 × 12 · +1,25 kg')).toBeTruthy();
  expect(screen.queryByText('Modifier l’exercice')).toBeNull();
});

test('refuses a value out of range, and says why out loud', async () => {
  const { plans } = await setup();
  await fireEvent.press(row(0, 0, 0));
  await type('Séries', '0');
  expect(screen.getByText('Enregistrer')).toBeDisabled();
  expect(screen.getByText('Un exercice a entre 1 et 20 séries.').props.accessibilityLiveRegion).toBe('polite');
  await type('Séries', '3');
  await type('Nom', ' ');
  expect(screen.getByText('Enregistrer')).toBeDisabled();
  expect(plans.plans[0].phases[0].sessions[0].exercises[0].name).toBe('Pompes');
});

test('« Annuler » leaves the exercise as it was', async () => {
  const { plans } = await setup();
  await fireEvent.press(row(0, 0, 0));
  await type('Séries', '5');
  await fireEvent.press(screen.getByText('Annuler'));
  expect(plans.plans[0].phases[0].sessions[0].exercises[0].sets).toBe(3);
});

test('adds an exercise at the end of a session', async () => {
  const { plans } = await setup();
  await fireEvent.press(screen.getByTestId('add-0-0'));
  expect(screen.getByText('Nouvel exercice')).toBeTruthy();
  expect(screen.getByText('Ajouter')).toBeDisabled();
  await type('Nom', 'Fentes sautées');
  await type('Séries', '3');
  await type('Répétitions', '10');
  await type('Incrément de charge (kg)', '0');
  await fireEvent.press(screen.getByText('Ajouter'));
  const exercises = plans.plans[0].phases[0].sessions[0].exercises;
  expect(exercises).toHaveLength(6);
  expect(exercises[5]).toEqual({ exerciseId: 'fentes-sautees', name: 'Fentes sautées', sets: 3, reps: 10, incrementKg: 0 });
});

test('removes an exercise after asking', async () => {
  const { plans } = await setup();
  await fireEvent.press(row(0, 0, 0));
  await fireEvent.press(screen.getByText('Supprimer l’exercice'));
  expect(screen.getByText('Supprimer l’exercice Pompes ?')).toBeTruthy();
  await fireEvent.press(screen.getByText('Annuler'));
  expect(plans.plans[0].phases[0].sessions[0].exercises).toHaveLength(5);
  await fireEvent.press(row(0, 0, 0));
  await fireEvent.press(screen.getByText('Supprimer l’exercice'));
  await fireEvent.press(screen.getByText('Supprimer'));
  expect(plans.plans[0].phases[0].sessions[0].exercises.map((e) => e.name)).not.toContain('Pompes');
});

test('never removes the last exercise of a session', async () => {
  const plan = starterPlan('2026-11-03');
  plan.phases[0].sessions[0].exercises = [plan.phases[0].sessions[0].exercises[0]];
  await setup(plan);
  await fireEvent.press(row(0, 0, 0));
  expect(screen.getByText('Supprimer l’exercice')).toBeDisabled();
  expect(screen.getByText('Une séance garde au moins un exercice.')).toBeTruthy();
});

test('opens the history of an exercise', async () => {
  const { onOpenHistory } = await setup();
  await fireEvent.press(row(0, 0, 1));
  await fireEvent.press(screen.getByText('Voir l’historique'));
  expect(onOpenHistory).toHaveBeenCalledWith('rowing-haltere', 'Rowing haltère');
});

test('renames the programme', async () => {
  const { plans } = await setup();
  await fireEvent.press(screen.getByLabelText('Renommer le programme'));
  await type('Nom du programme', 'Mon programme');
  await fireEvent.press(screen.getByText('Enregistrer'));
  expect(plans.plans[0].name).toBe('Mon programme');
  expect(screen.getByText('Mon programme')).toBeTruthy();
});
