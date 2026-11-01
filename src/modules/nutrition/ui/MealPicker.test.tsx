import { fireEvent, render, screen } from '@testing-library/react-native';
import { PaperProvider } from 'react-native-paper';
import { MealPicker } from './MealPicker';

const draw = (meal: 'breakfast' | 'lunch' | 'dinner' | 'snack' = 'lunch') => {
  const onChange = jest.fn();
  return render(
    <PaperProvider>
      <MealPicker meal={meal} onChange={onChange} />
    </PaperProvider>,
  ).then(() => onChange);
};

// Paper marks the chosen segment with `accessibilityState.checked`; its text also holds the glyph of the check.
const isChecked = (name: string) => screen.getByRole('button', { name: new RegExp(`^${name}|${name}$`) }).props.accessibilityState.checked;

test('offers the four groups, the chosen one checked', async () => {
  await draw('dinner');
  expect(screen.getAllByText(/^(Petit-déjeuner|Déjeuner|Dîner|Collations)$/).length).toBeGreaterThanOrEqual(3);
  expect(isChecked('Dîner')).toBe(true);
  expect(isChecked('Déjeuner')).toBe(false);
});

test('touching a group chooses it', async () => {
  const onChange = await draw();
  await fireEvent.press(screen.getByText('Collations'));
  expect(onChange).toHaveBeenCalledWith('snack');
});
