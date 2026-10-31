import { fireEvent, render, screen } from '@testing-library/react-native';
import { PaperProvider } from 'react-native-paper';
import { theme } from '@/theme';
import { MilestoneForm } from './MilestoneForm';

const exercises = [{ exerciseId: 'tractions', name: 'Tractions' }];

async function setup() {
  const onAdd = jest.fn();
  await render(
    <PaperProvider theme={theme}>
      <MilestoneForm exercises={exercises} onCancel={() => {}} onAdd={onAdd} />
    </PaperProvider>,
  );
  return { onAdd };
}

test('adds a milestone on an exercise: reps up to a target', async () => {
  const { onAdd } = await setup();
  await fireEvent.press(screen.getByText('Tractions'));
  await fireEvent.changeText(screen.getByLabelText('Cible'), '10');
  await fireEvent.press(screen.getByText('Ajouter'));
  expect(onAdd).toHaveBeenCalledWith({ metric: 'exercise:tractions:reps', target: 10, direction: 'up', label: 'Tractions : 10 répétitions' });
});

test('adds a milestone on the waist, going down to a target', async () => {
  const { onAdd } = await setup();
  await fireEvent.press(screen.getByText('Tour de taille'));
  await fireEvent.changeText(screen.getByLabelText('Cible'), '90');
  await fireEvent.press(screen.getByText('Ajouter'));
  expect(onAdd).toHaveBeenCalledWith({ metric: 'waistCm', target: 90, direction: 'down', label: 'Tour de taille sous 90 cm' });
});

test('adds a milestone on the weight, reaching up to a target', async () => {
  const { onAdd } = await setup();
  await fireEvent.press(screen.getByText('Poids'));
  await fireEvent.press(screen.getByText('Atteindre'));
  await fireEvent.changeText(screen.getByLabelText('Cible'), '85,5');
  await fireEvent.press(screen.getByText('Ajouter'));
  expect(onAdd).toHaveBeenCalledWith({ metric: 'weightKg', target: 85.5, direction: 'up', label: 'Poids : au moins 85,5 kg' });
});

test('choosing a measure hides the repetitions and the load, and an exercise brings them back', async () => {
  await setup();
  await fireEvent.press(screen.getByText('Poids'));
  expect(screen.queryByText('Répétitions')).toBeNull();
  expect(screen.getByText('Descendre à')).toBeTruthy();
  await fireEvent.press(screen.getByText('Tractions'));
  expect(screen.getByText('Répétitions')).toBeTruthy();
  expect(screen.queryByText('Descendre à')).toBeNull();
});

test('cannot add before a subject and a target are chosen', async () => {
  await setup();
  expect(screen.getByText('Ajouter')).toBeDisabled();
  await fireEvent.press(screen.getByText('Poids'));
  expect(screen.getByText('Ajouter')).toBeDisabled();
});
