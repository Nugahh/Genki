import { render, screen } from '@testing-library/react-native';
import { PaperProvider } from 'react-native-paper';
import { theme } from '@/theme';
import { GoalsWithPortion } from './GoalsWithPortion';

const goals = { kcal: 2200, proteinG: 130, carbsNetG: 255, fatG: 75 };
const total = (n: number) => n.toLocaleString('fr-FR');
const draw = (day: Partial<React.ComponentProps<typeof GoalsWithPortion>['day']> = {}, portion = { kcal: 300, protein: 20, carbs: 30, fat: 10 }) =>
  render(
    <PaperProvider theme={theme}>
      <GoalsWithPortion day={{ kcal: 1500, protein: 80, carbs: 150, fat: 40, ...day }} portion={portion} goals={goals} />
    </PaperProvider>,
  );

test('adds the portion to the day and measures it against each goal', async () => {
  await draw();
  expect(screen.getByLabelText(`Énergie : ${total(1800)} sur ${total(2200)} kcal avec cette portion`)).toBeTruthy();
  expect(screen.getByLabelText('Protéines : 100 sur 130 g avec cette portion')).toBeTruthy();
  expect(screen.getByLabelText('Glucides nets : 180 sur 255 g avec cette portion')).toBeTruthy();
  expect(screen.getByLabelText('Lipides : 50 sur 75 g avec cette portion')).toBeTruthy();
});

test('says so, in words, for a goal that the portion passes', async () => {
  await draw({ kcal: 2100 });
  expect(screen.getByLabelText(`Énergie : ${total(2400)} sur ${total(2200)} kcal avec cette portion, au-dessus de l’objectif`)).toBeTruthy();
});

test('shows the figures as text under their name', async () => {
  await draw();
  expect(screen.getByText('Énergie')).toBeTruthy();
  expect(screen.getByText(`${total(1800)} / ${total(2200)} kcal`)).toBeTruthy();
  expect(screen.getByText('100 / 130 g')).toBeTruthy();
});
