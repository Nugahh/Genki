import { fireEvent, render, screen, within } from '@testing-library/react-native';
import { PaperProvider } from 'react-native-paper';
import { theme } from '@/theme';
import { inMemoryFactsSource } from '../adapters/inMemoryFactsSource';
import type { FactsSource } from '../application/ports';
import { trackingUseCases } from '../application/trackingUseCases';
import type { DayFacts } from '../domain/metric';
import { metricById } from '../domain/metrics';
import { SuiviHub } from './SuiviHub';
import type { UiPrefs } from '@/modules/settings';

const goals = { kcal: 2000, proteinG: 100, waterMl: 2500, steps: 8000 };
const clock = { now: () => new Date('2026-10-31T10:00:00Z') }; // Saturday 31 October
const calories = metricById('calories')!;

const refusing = { observeRange: (_from: string, _to: string, _next: unknown, onError: (e: Error) => void) => (onError(new Error('denied')), () => {}) };

async function setup(ui: UiPrefs = { hubMetrics: ['calories', 'water', 'weight'] }, facts: Record<string, DayFacts> = {}, days: FactsSource = inMemoryFactsSource(facts)) {
  const tracking = trackingUseCases({ sources: { days, training: inMemoryFactsSource(), tobacco: inMemoryFactsSource(), meals: inMemoryFactsSource() }, clock, timezone: 'Europe/Paris' });
  const onUiChange = jest.fn();
  const onOpen = jest.fn();
  await render(
    <PaperProvider theme={theme}>
      <SuiviHub tracking={tracking} goals={goals} ui={ui} onUiChange={onUiChange} clock={clock} timezone="Europe/Paris" onOpen={onOpen} />
    </PaperProvider>,
  );
  return { onUiChange, onOpen };
}

test('shows a card for each statistic of the hub, in order, and skips an unknown one', async () => {
  await setup({ hubMetrics: ['water', 'gone', 'calories'] });
  expect(screen.getAllByTestId(/^card-/).map((n) => n.props.testID)).toEqual(['card-water', 'card-calories']);
});

test('a card says the average of the finished days of the week and how it moved since the week before', async () => {
  await setup(undefined, { '2026-10-20': { kcal: 1800 }, '2026-10-26': { kcal: 2000 }, '2026-10-27': { kcal: 1900 } });
  const card = within(screen.getByTestId('card-calories'));
  expect(card.getByText(calories.format(1950))).toBeTruthy();
  expect(card.getByText(`+${calories.format(150)}`)).toBeTruthy();
  expect(screen.getByLabelText(/^Calories, .* par rapport à la semaine précédente/)).toBeTruthy();
});

test('a card with nothing recorded says so', async () => {
  await setup();
  expect(within(screen.getByTestId('card-weight')).getByText('Pas encore de mesure')).toBeTruthy();
});

test('a card says when only today is recorded: there is no finished day to average yet', async () => {
  await setup({ hubMetrics: ['calories'] }, { '2026-10-31': { kcal: 300 } });
  expect(within(screen.getByTestId('card-calories')).getByText('Pas encore de jour terminé')).toBeTruthy();
});

test('a card says when its source refuses the read', async () => {
  await setup({ hubMetrics: ['calories'] }, {}, refusing as never);
  expect(within(screen.getByTestId('card-calories')).getByText('Impossible de charger')).toBeTruthy();
});

test('an empty hub says how to fill it', async () => {
  await setup({ hubMetrics: [] });
  expect(screen.getByText('Aucune statistique ici pour l’instant. Touche « Modifier » pour en ajouter.')).toBeTruthy();
});

test('in the year view, a card is the mean of the months', async () => {
  await setup({ hubMetrics: ['calories'], period: 'year' }, { '2026-09-15': { kcal: 1800 }, '2026-10-01': { kcal: 2000 }, '2025-10-01': { kcal: 1000 } });
  expect(screen.getByText('2026')).toBeTruthy();
  expect(within(screen.getByTestId('card-calories')).getByText(calories.format(1900))).toBeTruthy();
});

test('in the month view, a card is the mean of the finished days of the month', async () => {
  await setup({ hubMetrics: ['calories'], period: 'month' }, { '2026-10-05': { kcal: 2000 }, '2026-10-10': { kcal: 1800 }, '2026-10-31': { kcal: 300 }, '2026-09-15': { kcal: 1500 } });
  expect(screen.getByText('octobre 2026')).toBeTruthy();
  const card = within(screen.getByTestId('card-calories'));
  expect(card.getByText(calories.format(1900))).toBeTruthy(); // today, still going, is left out
  expect(card.getByText(`+${calories.format(400)}`)).toBeTruthy();
  expect(screen.getByLabelText(/^Calories, .* par rapport au mois précédent/)).toBeTruthy();
});

test('touching a card opens its section on that statistic', async () => {
  const { onOpen } = await setup();
  await fireEvent.press(screen.getByTestId('card-water'));
  expect(onOpen).toHaveBeenCalledWith('eau', 'water');
});

test('the period is chosen here and kept in the preferences', async () => {
  const { onUiChange } = await setup();
  expect(screen.getByText('Semaine du 26 oct. au 1 nov.')).toBeTruthy();
  await fireEvent.press(screen.getByText('Année'));
  expect(onUiChange).toHaveBeenCalledWith({ period: 'year' });
  await fireEvent.press(screen.getByText('Mois'));
  expect(onUiChange).toHaveBeenCalledWith({ period: 'month' });
});

describe('the editor', () => {
  const open = async (ui?: UiPrefs) => {
    const result = await setup(ui);
    await fireEvent.press(screen.getByText('Modifier'));
    return result;
  };

  test('moves a statistic down, up, or hides it', async () => {
    const { onUiChange } = await open();
    await fireEvent.press(screen.getByLabelText('Descendre Calories'));
    expect(onUiChange).toHaveBeenLastCalledWith({ hubMetrics: ['water', 'calories', 'weight'] });
    await fireEvent.press(screen.getByLabelText('Monter Poids'));
    expect(onUiChange).toHaveBeenLastCalledWith({ hubMetrics: ['calories', 'weight', 'water'] });
    await fireEvent.press(screen.getByLabelText('Masquer Eau'));
    expect(onUiChange).toHaveBeenLastCalledWith({ hubMetrics: ['calories', 'weight'] });
  });

  test('cannot move the first one up or the last one down', async () => {
    await open();
    expect(screen.getByLabelText('Monter Calories')).toBeDisabled();
    expect(screen.getByLabelText('Descendre Poids')).toBeDisabled();
  });

  test('adds a hidden statistic at the end', async () => {
    const { onUiChange } = await open();
    await fireEvent.press(screen.getByLabelText('Ajouter Glucides'));
    expect(onUiChange).toHaveBeenLastCalledWith({ hubMetrics: ['calories', 'water', 'weight', 'carbs'] });
    expect(screen.queryByLabelText('Ajouter Calories')).toBeNull();
  });

  test('does not offer the nutrients: they have their own screen', async () => {
    await open();
    expect(screen.getByLabelText('Ajouter Glucides')).toBeTruthy();
    expect(screen.queryByLabelText('Ajouter Fer')).toBeNull();
    expect(screen.queryByLabelText('Ajouter Vitamine C')).toBeNull();
  });

  test('closes', async () => {
    await open();
    expect(screen.getByText('Ajouter une statistique')).toBeTruthy();
    await fireEvent.press(screen.getByText('Terminé'));
    expect(screen.queryByText('Ajouter une statistique')).toBeNull();
  });
});
