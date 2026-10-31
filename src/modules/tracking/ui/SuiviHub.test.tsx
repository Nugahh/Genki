import { fireEvent, render, screen, within } from '@testing-library/react-native';
import { PaperProvider } from 'react-native-paper';
import { theme } from '@/theme';
import { inMemoryFactsSource } from '../adapters/inMemoryFactsSource';
import { trackingUseCases } from '../application/trackingUseCases';
import type { DayFacts } from '../domain/metric';
import { metricById } from '../domain/metrics';
import { SuiviHub } from './SuiviHub';
import type { UiPrefs } from '@/modules/settings';

const goals = { kcal: 2000, proteinG: 100, waterMl: 2500, steps: 8000 };
const clock = { now: () => new Date('2026-10-31T10:00:00Z') }; // Saturday 31 October
const calories = metricById('calories')!;

async function setup(ui: UiPrefs = { hubMetrics: ['calories', 'water', 'weight'] }, facts: Record<string, DayFacts> = {}) {
  const tracking = trackingUseCases({ sources: [inMemoryFactsSource(facts)], goals, clock, timezone: 'Europe/Paris' });
  const onUiChange = jest.fn();
  const onOpen = jest.fn();
  await render(
    <PaperProvider theme={theme}>
      <SuiviHub tracking={tracking} ui={ui} onUiChange={onUiChange} clock={clock} timezone="Europe/Paris" onOpen={onOpen} />
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

  test('closes', async () => {
    await open();
    await fireEvent.press(screen.getByText('Terminé'));
    expect(screen.queryByText('Ajouter une statistique')).toBeNull();
  });
});
