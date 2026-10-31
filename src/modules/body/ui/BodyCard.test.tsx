import { fireEvent, render, screen } from '@testing-library/react-native';
import { PaperProvider } from 'react-native-paper';
import { inMemoryMilestoneRepository, inMemoryPlanRepository, inMemoryWorkoutRepository, trainingUseCases } from '@/modules/training';
import { theme } from '@/theme';
import { inMemoryBodyRepository } from '../adapters/inMemoryBodyRepository';
import { bodyUseCases } from '../application/bodyUseCases';
import { BodyCard } from './BodyCard';
import { BodyExtras } from './BodyExtras';

const clock = { now: () => new Date('2026-11-03T10:00:00Z') };

function setup() {
  const milestones = inMemoryMilestoneRepository();
  const training = trainingUseCases({ plans: inMemoryPlanRepository(), workouts: inMemoryWorkoutRepository(milestones), milestones, clock, timezone: 'Europe/Paris' });
  const body = bodyUseCases({ repo: inMemoryBodyRepository(milestones), milestones: training.listMilestones, clock, timezone: 'Europe/Paris' });
  const run = jest.fn((write: () => Promise<void>) => void write());
  return { body, run };
}
const draw = (ui: React.ReactElement) => render(<PaperProvider theme={theme}>{ui}</PaperProvider>);
const type = (label: string, text: string) => fireEvent.changeText(screen.getByLabelText(label), text);

describe('BodyCard', () => {
  test('says there is no weighing yet, and opens the weight on a touch', async () => {
    const { body, run } = setup();
    const onOpen = jest.fn();
    await draw(<BodyCard body={body} clock={clock} timezone="Europe/Paris" run={run} onOpen={onOpen} />);
    expect(screen.getByText('Pas encore de pesée')).toBeTruthy();
    expect(screen.getByText('—')).toBeTruthy();
    await fireEvent.press(screen.getByText('Poids'));
    expect(onOpen).toHaveBeenCalled();
  });

  test('enters a weight in one tap, and shows it with the mean of the seven days', async () => {
    const { body, run } = setup();
    await body.save({ weightKg: 82 }, '2026-11-01');
    await draw(<BodyCard body={body} clock={clock} timezone="Europe/Paris" run={run} onOpen={() => {}} />);
    await fireEvent.press(screen.getByLabelText('Saisir une mesure'));
    await type('Poids (kg)', '80,5');
    await type('Tour de taille (cm)', '92');
    await fireEvent.press(screen.getByText('Enregistrer'));
    expect(run).toHaveBeenCalledTimes(1);
    expect(await screen.findByText('80,5 kg')).toBeTruthy();
    expect(screen.getByText('Moyenne sur 7 jours : 81,3 kg · Tour de taille : 92 cm')).toBeTruthy();
    expect(screen.getByLabelText(/^Poids, 80,5 kg, Moyenne sur 7 jours/)).toBeTruthy();
  });

  test('refuses a weight out of range with its message, and keeps the dialog', async () => {
    const { body, run } = setup();
    await draw(<BodyCard body={body} clock={clock} timezone="Europe/Paris" run={run} onOpen={() => {}} />);
    await fireEvent.press(screen.getByLabelText('Saisir une mesure'));
    await type('Poids (kg)', '5');
    expect(screen.getByText('Le poids est compris entre 20 et 400 kg.').props.accessibilityLiveRegion).toBe('polite');
    expect(screen.getByText('Enregistrer')).toBeDisabled();
  });

  test('starts the dialog on the measures of the day', async () => {
    const { body, run } = setup();
    await body.save({ weightKg: 80, waistCm: 91 });
    await draw(<BodyCard body={body} clock={clock} timezone="Europe/Paris" run={run} onOpen={() => {}} />);
    await fireEvent.press(screen.getByLabelText('Saisir une mesure'));
    expect(screen.getByLabelText('Poids (kg)')).toHaveDisplayValue('80');
    expect(screen.getByLabelText('Tour de taille (cm)')).toHaveDisplayValue('91');
  });
});

test('BodyExtras enters a measure through run', async () => {
  const { body, run } = setup();
  await draw(<BodyExtras body={body} clock={clock} timezone="Europe/Paris" run={run} />);
  await fireEvent.press(screen.getByText('Saisir une mesure'));
  await type('Tour de taille (cm)', '88');
  await fireEvent.press(screen.getByText('Enregistrer'));
  expect(run).toHaveBeenCalledTimes(1);
});
