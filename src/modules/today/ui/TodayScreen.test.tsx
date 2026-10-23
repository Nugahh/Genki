import { fireEvent, render, screen } from '@testing-library/react-native';
import { PaperProvider } from 'react-native-paper';
import { inMemoryWaterRepository, waterUseCases } from '@/modules/hydration';
import { DEFAULT_PROFILE } from '@/modules/settings';
import type { DayTotalsRepository } from '../application/ports';
import { TodayScreen } from './TodayScreen';

// 15:00 in Paris: half of the daily water goal is expected by now.
const clock = { now: () => new Date('2026-10-23T13:00:00Z') };

function renderToday() {
  const water = inMemoryWaterRepository();
  // Day totals as Firestore keeps them: the sum of the day's live glasses.
  const dayTotals: DayTotalsRepository = {
    observe: (day, onNext) =>
      water.observeDay(
        day,
        (entries) =>
          onNext({ waterMl: entries.reduce((sum, e) => sum + e.ml, 0) }, { hasPendingWrites: false, fromCache: false }),
        () => {},
      ),
  };
  return render(
    <PaperProvider>
      <TodayScreen
        profile={DEFAULT_PROFILE}
        clock={clock}
        dayTotals={dayTotals}
        hydration={waterUseCases(water, clock, DEFAULT_PROFILE.timezone)}
        run={(write) => void write()}
      />
    </PaperProvider>,
  );
}

test('a quick-add button fills the water gauge', async () => {
  await renderToday();
  expect(screen.getByLabelText('Eau : 0 / 2,5 L')).toBeTruthy();
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
