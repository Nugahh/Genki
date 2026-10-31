import { fireEvent, render, screen } from '@testing-library/react-native';
import { PaperProvider } from 'react-native-paper';
import { theme } from '@/theme';
import { DEFAULT_PROFILE } from '../domain/profile';
import { SetupScreen } from './SetupScreen';

const type = (label: string, text: string) => fireEvent.changeText(screen.getByLabelText(label), text);

async function setup() {
  const onDone = jest.fn();
  const onSkip = jest.fn();
  await render(
    <PaperProvider theme={theme}>
      <SetupScreen profile={DEFAULT_PROFILE} year={2026} onDone={onDone} onSkip={onSkip} />
    </PaperProvider>,
  );
  return { onDone, onSkip };
}

const fillYou = async () => {
  await type('Année de naissance', '1996');
  await type('Taille (cm)', '180');
  await type('Poids (kg)', '80');
};

test('asks for the profile first, and cannot go on before it is complete', async () => {
  await setup();
  expect(screen.getByText('Voir mes objectifs')).toBeDisabled();
  await fillYou();
  expect(screen.getByText('Voir mes objectifs')).toBeEnabled();
});

test('refuses a weight out of range', async () => {
  await setup();
  await fillYou();
  await type('Poids (kg)', '10');
  expect(screen.getByText('Voir mes objectifs')).toBeDisabled();
});

test('proposes the goals for the profile and the mode, with the notes', async () => {
  await setup();
  await fillYou();
  await fireEvent.press(screen.getByText('Femme'));
  await fireEvent.press(screen.getByText('Voir mes objectifs'));
  // A 30-year-old woman, 180 cm, 80 kg, moderately active, in a deficit: 1 614 x 1.375 - 400, to the nearest 10.
  expect(screen.getByLabelText('Calories (kcal par jour)')).toHaveDisplayValue('1820');
  expect(screen.getByLabelText('Protéines (g par jour)')).toHaveDisplayValue('135');
  expect(screen.getByText(/Consulte un professionnel/)).toBeTruthy();
});

test('lets the goals be changed, then finishes with the profile, the goals and the weight', async () => {
  const { onDone } = await setup();
  await fillYou();
  await fireEvent.press(screen.getByText('Maintien'));
  await fireEvent.press(screen.getByText('Voir mes objectifs'));
  await type('Eau (ml par jour)', '3000');
  await fireEvent.press(screen.getByText('Terminer'));
  expect(onDone).toHaveBeenCalledWith(
    { sex: 'male', birthYear: 1996, heightCm: 180, activityLevel: 'light', goalMode: 'maintenance', weeklyLossKg: null, goals: { kcal: 2450, proteinG: 135, waterMl: 3000, steps: 8000 }, createdAt: expect.any(Date) },
    80,
  );
});

test('goes back to the profile, and skips with the defaults', async () => {
  const { onSkip } = await setup();
  await fillYou();
  await fireEvent.press(screen.getByText('Voir mes objectifs'));
  await fireEvent.press(screen.getByText('Retour'));
  expect(screen.getByText('Faisons connaissance')).toBeTruthy();
  await fireEvent.press(screen.getByText('Passer'));
  expect(onSkip).toHaveBeenCalled();
});
