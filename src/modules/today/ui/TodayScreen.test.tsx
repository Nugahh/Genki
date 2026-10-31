import { fireEvent, render, screen, within } from '@testing-library/react-native';
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
  return { onAddMeal, onOpenMeals, water };
}

test('a quick-add button fills the water gauge', async () => {
  await renderToday();
  expect(screen.getByLabelText('Eau : 0 L, sur 2,5 L, reste 2,5 L')).toHaveAccessibilityValue({ text: 'en retard' });
  await fireEvent.press(screen.getByText('+500 ml'));
  expect(screen.getByLabelText('Eau : 0,5 L, sur 2,5 L, reste 2 L')).toBeTruthy();
});

test('the quick-add buttons stay outside the scrolling gauges, under the thumb whatever the day holds', async () => {
  await renderToday();
  const scrolling = within(screen.getByTestId('gauges'));
  expect(scrolling.getByLabelText(/^Eau : /)).toBeTruthy();
  expect(scrolling.queryByText('+250 ml')).toBeNull();
  expect(scrolling.queryByText('+ Repas')).toBeNull();
  expect(screen.getByText('+250 ml')).toBeTruthy();
  expect(screen.getByText('+ Repas')).toBeTruthy();
});

test('a quick add offers to take the glass back, and « Annuler » does', async () => {
  const { water } = await renderToday();
  await fireEvent.press(screen.getByText('+250 ml'));
  expect(screen.getByText('+250 ml ajoutés')).toBeTruthy();
  expect(screen.getByLabelText('Eau : 0,25 L, sur 2,5 L, reste 2,25 L')).toBeTruthy();

  await fireEvent.press(screen.getByText('Annuler'));
  expect(water.entries).toEqual([]);
  expect(screen.getByLabelText('Eau : 0 L, sur 2,5 L, reste 2,5 L')).toBeTruthy();
  expect(screen.queryByText('+250 ml ajoutés')).toBeNull();
});

test('a second quick add replaces the offer: « Annuler » takes back the last glass only', async () => {
  const { water } = await renderToday();
  await fireEvent.press(screen.getByText('+250 ml'));
  await fireEvent.press(screen.getByText('+500 ml'));
  expect(screen.queryByText('+250 ml ajoutés')).toBeNull();

  await fireEvent.press(screen.getByText('Annuler'));
  expect(water.entries.map((e) => e.ml)).toEqual([250]);
});

test('the water gauge opens the day sheet, where a glass can be removed', async () => {
  await renderToday();
  await fireEvent.press(screen.getByText('+250 ml'));
  await fireEvent.press(screen.getByLabelText('Eau : 0,25 L, sur 2,5 L, reste 2,25 L'));
  await fireEvent.press(screen.getByLabelText('Supprimer 250 ml de 15:00'));
  expect(screen.getByText('Aucun verre aujourd’hui.')).toBeTruthy();
  // The gauge sits behind the open sheet.
  expect(screen.getByLabelText('Eau : 0 L, sur 2,5 L, reste 2,5 L', { includeHiddenElements: true })).toBeTruthy();
});

test('the Calories and Protéines gauges show the day against the goals', async () => {
  await renderToday({ kcal: 1500, proteinG: 52.3 });
  expect(screen.getByLabelText(`Calories : ${fr(1500)} kcal, sur ${fr(2200)} kcal, reste ${fr(700)} kcal`)).toBeTruthy();
  expect(screen.getByLabelText(`Protéines : ${fr(52.3)} g, sur ${fr(130)} g, reste ${fr(77.7)} g`)).toBeTruthy();
});

test('each gauge tells a screen reader what a touch does', async () => {
  await renderToday();
  expect(screen.getByLabelText(/^Eau : /).props.accessibilityHint).toBe('Ouvre les verres du jour');
  expect(screen.getByLabelText(/^Calories : /).props.accessibilityHint).toBe('Ouvre le journal des repas');
  expect(screen.getByLabelText(/^Protéines : /).props.accessibilityHint).toBe('Ouvre le journal des repas');
});

test('a gauge shows the day in big, and beneath it the goal and what is left of it', async () => {
  await renderToday({ kcal: 1500, proteinG: 52.3 });
  expect(screen.getByText(`${fr(1500)} kcal`)).toBeTruthy();
  expect(screen.getByText(`sur ${fr(2200)} kcal · reste ${fr(700)} kcal`)).toBeTruthy();
  expect(screen.getByText('sur 2,5 L · reste 2,5 L')).toBeTruthy();
});

test('a gauge at its goal says so instead of a remainder, and Calories above it says that', async () => {
  await renderToday({ kcal: 2400, proteinG: 130 });
  expect(screen.getByText(`sur ${fr(130)} g · objectif atteint`)).toBeTruthy();
  expect(screen.getByText(`sur ${fr(2200)} kcal · au-dessus de l’objectif`)).toBeTruthy();
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
