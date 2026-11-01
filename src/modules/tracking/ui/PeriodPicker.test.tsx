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
