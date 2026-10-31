import { fireEvent, render, screen } from '@testing-library/react-native';
import { PaperProvider } from 'react-native-paper';
import { inMemoryWaterRepository, waterUseCases } from '@/modules/hydration';
import { DEFAULT_PROFILE } from '@/modules/settings';
import { theme } from '@/theme';
import type { DayTotalsRepository } from '../application/ports';
import { TodayScreen } from './TodayScreen';

// 15:00 in Paris: half of the daily goals is expected by now.
const clock = { now: () => new Date('2026-10-23T13:00:00Z') };
const fr = (n: number) => n.toLocaleString('fr-FR');

async function renderToday({ kcal = 0, proteinG = 0 }: { kcal?: number; proteinG?: number } = {}) {
  const water = inMemoryWaterRepository();
  // Day totals as Firestore keeps them: the water is the sum of the day's live glasses.
  const dayTotals: DayTotalsRepository = {
    observe: (day, onNext) =>
      water.observeDay(
        day,
        (entries) =>
          onNext(
            { waterMl: entries.reduce((sum, e) => sum + e.ml, 0), kcal, proteinG, carbsG: 0, fatG: 0 },
            { hasPendingWrites: false, fromCache: false },
          ),
        () => {},
      ),
  };
  const onAddMeal = jest.fn();
  const onOpenMeals = jest.fn();
  await render(
    <PaperProvider theme={theme}>
      <TodayScreen
        profile={DEFAULT_PROFILE}
        clock={clock}
        dayTotals={dayTotals}
        hydration={waterUseCases(water, clock, DEFAULT_PROFILE.timezone)}
        run={(write) => void write()}
        onAddMeal={onAddMeal}
        onOpenMeals={onOpenMeals}
      />
    </PaperProvider>,
  );
  return { onAddMeal, onOpenMeals };
}

test('a quick-add button fills the water gauge', async () => {
  await renderToday();
  expect(screen.getByLabelText('Eau : 0 / 2,5 L')).toHaveAccessibilityValue({ text: 'en retard' });
  await fireEvent.press(screen.getByText('+500 ml'));
  expect(screen.getByLabelText('Eau : 0,5 / 2,5 L')).toBeTruthy();
});

test('the water gauge opens the day sheet, where a glass can be removed', async () => {
  await renderToday();
  await fireEvent.press(screen.getByText('+250 ml'));
  await fireEvent.press(screen.getByLabelText('Eau : 0,25 / 2,5 L'));
  await fireEvent.press(screen.getByLabelText('Supprimer 250 ml de 15:00'));
  expect(screen.getByText('Aucun verre aujourd’hui.')).toBeTruthy();
  // The gauge sits behind the open sheet.
  expect(screen.getByLabelText('Eau : 0 / 2,5 L', { includeHiddenElements: true })).toBeTruthy();
});

test('the Calories and Protéines gauges show the day against the goals', async () => {
  await renderToday({ kcal: 1500, proteinG: 52.3 });
  expect(screen.getByLabelText(`Calories : ${fr(1500)} / ${fr(2200)} kcal`)).toBeTruthy();
  expect(screen.getByLabelText(`Protéines : ${fr(52.3)} / ${fr(130)} g`)).toBeTruthy();
});

test('the Calories and Protéines gauges open the Meals tab', async () => {
  const { onOpenMeals } = await renderToday();
  await fireEvent.press(screen.getByLabelText(/^Calories : /));
  expect(onOpenMeals).toHaveBeenCalledTimes(1);
  await fireEvent.press(screen.getByLabelText(/^Protéines : /));
  expect(onOpenMeals).toHaveBeenCalledTimes(2);
});

test('« + Repas » adds a meal', async () => {
  const { onAddMeal } = await renderToday();
  await fireEvent.press(screen.getByLabelText('Ajouter un repas'));
  expect(onAddMeal).toHaveBeenCalledTimes(1);
});

test('the Calories gauge is red and over the goal above 110 %, while Protéines only follows the pace', async () => {
  // 2 500 of 2 200 kcal is 114 %; 200 of 130 g is far above the goal but on pace.
  await renderToday({ kcal: 2500, proteinG: 200 });
  expect(screen.getByLabelText(/^Calories : /)).toHaveAccessibilityValue({ text: 'au-dessus de l’objectif' });
  expect(screen.getByLabelText(/^Protéines : /)).toHaveAccessibilityValue({ text: 'dans le rythme' });
});

test.each([
  [300, 'en retard'], // 14 % of the goal when half is expected: the pace, as for the water
  [2300, 'dans le rythme'], // 104.5 %: not over the goal yet
  [2400, 'au-dessus de l’objectif'], // 109 %: orange because of the overshoot, not the pace
])('the Calories gauge with %i kcal is read « %s »', async (kcal, status) => {
  await renderToday({ kcal });
  expect(screen.getByLabelText(/^Calories : /)).toHaveAccessibilityValue({ text: status });
});
