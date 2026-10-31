import { fireEvent, render, screen } from '@testing-library/react-native';
import { PaperProvider } from 'react-native-paper';
import { theme } from '@/theme';
import { inMemoryFactsSource } from '../adapters/inMemoryFactsSource';
import { trackingUseCases } from '../application/trackingUseCases';
import { NutritionExtras } from './NutritionExtras';
import { TrainingExtras } from './TrainingExtras';

const goals = { kcal: 2000, proteinG: 100, waterMl: 2500, steps: 8000 };
const clock = { now: () => new Date('2026-10-31T10:00:00Z') };
const draw = (ui: React.ReactElement) => render(<PaperProvider theme={theme}>{ui}</PaperProvider>);

describe('NutritionExtras', () => {
  test('shares the energy between protein, carbs and fat, and opens the journal', async () => {
    const onOpenJournal = jest.fn();
    await draw(<NutritionExtras split={{ proteinPct: 24, carbsPct: 48, fatPct: 27 }} onOpenJournal={onOpenJournal} />);
    expect(screen.getByText('Protéines')).toBeTruthy();
    expect(screen.getByText('24 %')).toBeTruthy();
    expect(screen.getByText('48 %')).toBeTruthy();
    expect(screen.getByText('27 %')).toBeTruthy();
    await fireEvent.press(screen.getByText('Ouvrir le journal du jour'));
    expect(onOpenJournal).toHaveBeenCalled();
  });

  test('still opens the journal when no macros were recorded', async () => {
    await draw(<NutritionExtras split={undefined} onOpenJournal={() => {}} />);
    expect(screen.queryByText('Répartition de l’énergie')).toBeNull();
    expect(screen.getByText('Ouvrir le journal du jour')).toBeTruthy();
  });
});

describe('TrainingExtras', () => {
  const tracking = trackingUseCases({
    sources: [inMemoryFactsSource({ '2026-10-26': { sessions: 1, volumeKg: 3000 }, '2026-10-28': { sessions: 1 }, '2026-10-31': { sessions: 1 }, '2026-10-20': { sessions: 1 } })],
    goals,
    clock,
    timezone: 'Europe/Paris',
  });

  test('counts the sessions of the week against the sessions planned, today included', async () => {
    const onOpenSport = jest.fn();
    await draw(<TrainingExtras tracking={tracking} period="week" day="2026-10-31" planned={3} onOpenSport={onOpenSport} />);
    expect(screen.getByText('Séances de la semaine : 3 sur 3')).toBeTruthy();
    await fireEvent.press(screen.getByText('Voir le programme et les paliers'));
    expect(onOpenSport).toHaveBeenCalled();
  });

  test('counts without a plan, and only over a week', async () => {
    const { unmount } = await draw(<TrainingExtras tracking={tracking} period="week" day="2026-10-31" onOpenSport={() => {}} />);
    expect(screen.getByText('Séances de la semaine : 3')).toBeTruthy();
    await unmount();
    await draw(<TrainingExtras tracking={tracking} period="year" day="2026-10-31" planned={3} onOpenSport={() => {}} />);
    expect(screen.queryByText(/Séances de la semaine/)).toBeNull();
  });
});
