import { render, screen } from '@testing-library/react-native';
import { PaperProvider } from 'react-native-paper';
import { theme } from '@/theme';
import { EnergyRing } from './EnergyRing';

const draw = (props: Partial<React.ComponentProps<typeof EnergyRing>> = {}) =>
  render(
    <PaperProvider theme={theme}>
      <EnergyRing kcal={290} protein={20} carbs={30} fat={10} {...props} />
    </PaperProvider>,
  );

test('puts the calories of the portion at the centre', async () => {
  await draw();
  expect(screen.getByText('290')).toBeTruthy();
  expect(screen.getByText('kcal')).toBeTruthy();
});

test('draws one arc for each macro that gives energy', async () => {
  await draw();
  expect(screen.getAllByTestId(/^arc-/).map((arc) => arc.props.testID)).toEqual(['arc-protein', 'arc-carbs', 'arc-fat']);
  await screen.unmount();
  await draw({ protein: 20, carbs: 0, fat: 0 });
  expect(screen.getAllByTestId(/^arc-/).map((arc) => arc.props.testID)).toEqual(['arc-protein']);
});

test('the ring is never alone: grams and percentages in text, and an alternative text that says the three shares', async () => {
  await draw();
  expect(screen.getByText('Protéines')).toBeTruthy();
  expect(screen.getByText('20 g · 28 %')).toBeTruthy();
  expect(screen.getByText('30 g · 41 %')).toBeTruthy();
  expect(screen.getByText('10 g · 31 %')).toBeTruthy();
  expect(screen.getByRole('image').props.accessibilityLabel).toBe('Énergie : 290 kcal. Protéines 28 %, glucides nets 41 %, lipides 31 %.');
});

test('says when the net carbs are only the carbohydrates because the fibre is not known', async () => {
  await draw({ carbsPartial: true });
  expect(screen.getByText('Glucides nets (partiel)')).toBeTruthy();
  expect(screen.getByRole('image').props.accessibilityLabel).toContain('glucides nets 41 % (partiel)');
});

test('without energy there is no arc and no share', async () => {
  await draw({ kcal: 0, protein: 0, carbs: 0, fat: 0 });
  expect(screen.queryAllByTestId(/^arc-/)).toHaveLength(0);
  expect(screen.getByRole('image').props.accessibilityLabel).toBe('Énergie : 0 kcal.');
});
