import { fireEvent, render, screen } from '@testing-library/react-native';
import { PaperProvider } from 'react-native-paper';
import { theme } from '@/theme';
import { PeriodPicker } from './PeriodPicker';

const draw = async (props: Partial<React.ComponentProps<typeof PeriodPicker>> = {}) => {
  const onPeriod = jest.fn();
  await render(
    <PaperProvider theme={theme}>
      <PeriodPicker period="week" onPeriod={onPeriod} title="Semaine du 26 oct. au 1 nov." {...props} />
    </PaperProvider>,
  );
  return { onPeriod };
};

test('offers the day, the week, the month and the year, in that order', async () => {
  await draw();
  expect(screen.getAllByText(/^(Jour|Semaine|Mois|Année)$/).map((n) => n.props.children)).toEqual(['Jour', 'Semaine', 'Mois', 'Année']);
});

test('touching Mois chooses the month', async () => {
  const { onPeriod } = await draw();
  await fireEvent.press(screen.getByText('Mois'));
  expect(onPeriod).toHaveBeenCalledWith('month');
});

// Paper marks the chosen segment with `accessibilityState.checked`; its text also holds the glyph of the check.
const isChecked = (name: string) => screen.getByRole('button', { name: new RegExp(`^${name}|${name}$`) }).props.accessibilityState.checked;

test('the chosen period carries the check, the others do not', async () => {
  await draw({ period: 'month' });
  expect(isChecked('Mois')).toBe(true);
  expect([isChecked('Jour'), isChecked('Semaine'), isChecked('Année')]).toEqual([false, false, false]);
});
