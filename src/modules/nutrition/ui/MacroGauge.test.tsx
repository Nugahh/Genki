import { render, screen } from '@testing-library/react-native';
import { PaperProvider } from 'react-native-paper';
import { theme } from '@/theme';
import { MacroGauge } from './MacroGauge';

const fr = (n: number) => n.toLocaleString('fr-FR');
const draw = (props: Partial<React.ComponentProps<typeof MacroGauge>> = {}) =>
  render(
    <PaperProvider theme={theme}>
      <MacroGauge metric="calories" label="Énergie" value={0} goal={2079} unit="kcal" {...props} />
    </PaperProvider>,
  );

test('reads « Énergie – 0 / 2 079 kcal », with the percentage to the right of the bar', async () => {
  await draw();
  expect(screen.getByText(`Énergie – 0 / ${fr(2079)} kcal`)).toBeTruthy();
  expect(screen.getByText('0 %')).toBeTruthy();
});

test('shows the progress as a whole percent', async () => {
  await draw({ value: 700, goal: 2200 });
  expect(screen.getByText(`Énergie – 700 / ${fr(2200)} kcal`)).toBeTruthy();
  expect(screen.getByText('32 %')).toBeTruthy();
});

test('does not say what is left', async () => {
  await draw({ value: 700, goal: 2200 });
  expect(screen.queryByText(/reste/i)).toBeNull();
});

test('keeps the grams and the comma of the other macros', async () => {
  await draw({ metric: 'fat', label: 'Lipides', value: 1.2, goal: 75, unit: 'g' });
  expect(screen.getByText('Lipides – 1,2 / 75 g')).toBeTruthy();
  expect(screen.getByText('2 %')).toBeTruthy();
});

test('past the goal the bar is full and the percentage says how far, in words too', async () => {
  await draw({ value: 2500, goal: 2000 });
  expect(screen.getByText('125 %')).toBeTruthy();
  expect(screen.getByRole('progressbar').props.accessibilityLabel).toBe(`Énergie : ${fr(2500)} sur ${fr(2000)} kcal, 125 %, au-dessus de l’objectif`);
  expect(screen.getByRole('progressbar').props.accessibilityValue).toEqual({ min: 0, max: 100, now: 100, text: '125 %' });
});

test('is announced as a progress with its figures and its percentage', async () => {
  await draw({ metric: 'protein', label: 'Protéines', value: 14, goal: 130, unit: 'g' });
  const bar = screen.getByRole('progressbar');
  expect(bar.props.accessibilityLabel).toBe('Protéines : 14 sur 130 g, 11 %');
  expect(bar.props.accessibilityValue).toEqual({ min: 0, max: 100, now: 11, text: '11 %' });
});

test('has no goal to measure against: 0 %, never NaN', async () => {
  await draw({ value: 40, goal: 0 });
  expect(screen.getByText('0 %')).toBeTruthy();
  expect(screen.queryByText(/NaN/)).toBeNull();
});

test('each macro wears the disc of its own tint, with its icon', async () => {
  await draw({ metric: 'carbs', label: 'Glucides nets', unit: 'g', goal: 255 });
  expect(screen.getByTestId('macro-badge-carbs')).toHaveStyle({ backgroundColor: theme.colors.metric.carbs.container });
});
