import { fireEvent, render, screen } from '@testing-library/react-native';
import { PaperProvider } from 'react-native-paper';
import type { UiPrefs } from '@/modules/settings';
import { theme } from '@/theme';
import { inMemoryFactsSource } from '../adapters/inMemoryFactsSource';
import { trackingUseCases } from '../application/trackingUseCases';
import type { DayFacts, Goals } from '../domain/metric';
import { MicronutrientsScreen } from './MicronutrientsScreen';

const clock = { now: () => new Date('2026-10-31T10:00:00Z') }; // Saturday 31 October
const goals: Goals = { kcal: 2000, proteinG: 100, waterMl: 2500, steps: 8000, nutrients: { iron: 11, vitC: 110, salt: 5, fiber: 30, calcium: 1000 } };

const MEALS: Record<string, DayFacts> = {
  '2026-10-26': { nutrients: { iron: 11, vitC: 110, salt: 4, fiber: 20, calcium: 800 }, incomplete: ['calcium'] },
  '2026-10-27': { nutrients: { iron: 11, vitC: 55, salt: 5.5, fiber: 20, calcium: 800 }, incomplete: ['calcium'] },
};

async function setup(props: { startOn?: 'day'; ui?: UiPrefs; meals?: Record<string, DayFacts>; goals?: Goals } = {}) {
  const meals = inMemoryFactsSource(props.meals ?? MEALS);
  const tracking = trackingUseCases({ sources: { days: inMemoryFactsSource(), training: inMemoryFactsSource(), tobacco: inMemoryFactsSource(), meals }, clock, timezone: 'Europe/Paris' });
  const onUiChange = jest.fn();
  const onOpen = jest.fn();
  await render(
    <PaperProvider theme={theme}>
      <MicronutrientsScreen tracking={tracking} goals={props.goals ?? goals} ui={props.ui ?? {}} onUiChange={onUiChange} clock={clock} timezone="Europe/Paris" startOn={props.startOn} onOpen={onOpen} />
    </PaperProvider>,
  );
  return { meals, onUiChange, onOpen };
}

const row = (name: string) => screen.getByRole('button', { name: new RegExp(`^${name},`) }).props.accessibilityLabel as string;

test('groups what to reach (vitamins, minerals, fibre) apart from what to limit', async () => {
  await setup();
  expect(screen.getAllByRole('header').map((h) => h.props.children)).toEqual(['À atteindre', 'Vitamines', 'Minéraux', 'Fibres', 'À limiter']);
});

test('each row says its amount, its share of the reference and where it stands, in words', async () => {
  await setup();
  expect(row('Fer')).toBe('Fer, 11 mg, 100 % du repère, dans la cible');
  expect(row('Vitamine C')).toBe('Vitamine C, 82,5 mg, 75 % du repère, proche de la cible');
  expect(row('Fibres')).toBe('Fibres, 20 g, 67 % du repère, proche de la cible');
  expect(row('Sel')).toBe('Sel, 4,75 g, 95 % du repère, sous la limite');
});

test('an amount that a meal may lack is a minimum: « au moins », « partiel », and no colour judgement', async () => {
  await setup();
  expect(row('Calcium')).toBe('Calcium, au moins 800 mg, 80 % du repère, valeur partielle');
  expect(screen.getAllByText('partiel').length).toBeGreaterThan(0);
});

test('a nutrient with no value says so', async () => {
  await setup();
  expect(row('Zinc')).toBe('Zinc, aucune donnée');
});

test('touching a nutrient opens it', async () => {
  const { onOpen } = await setup();
  await fireEvent.press(screen.getByRole('button', { name: /^Fer,/ }));
  expect(onOpen).toHaveBeenCalledWith('iron');
});

test('without references the totals stay and the percentages go, with a word on adults', async () => {
  await setup({ goals: { ...goals, nutrients: {} } });
  expect(row('Fer')).toBe('Fer, 11 mg');
  expect(screen.getByText('Les repères de l’ANSES sont donnés pour les adultes de 18 ans et plus.')).toBeTruthy();
});

test('says it is not medical advice', async () => {
  await setup();
  expect(screen.getByText('Repères de l’ANSES pour adultes. Ce n’est pas un avis médical.')).toBeTruthy();
});

test('with no meal in the period it says what to do instead of listing empty rows', async () => {
  await setup({ meals: {} });
  expect(screen.getByText('Ajoute un aliment de la table Ciqual pour voir tes vitamines et minéraux.')).toBeTruthy();
  expect(screen.queryByText('Vitamines')).toBeNull();
});

test('offers no year, and reads a month when the year is the choice', async () => {
  const { meals } = await setup({ ui: { period: 'year' } });
  expect(screen.queryByText('Année')).toBeNull();
  expect(screen.getByText('octobre 2026')).toBeTruthy();
  expect(meals.ranges).toEqual([['2026-10-01', '2026-10-31']]);
});

test('the period picker changes the period', async () => {
  const { onUiChange } = await setup();
  await fireEvent.press(screen.getByText('Jour'));
  expect(onUiChange).toHaveBeenCalledWith({ period: 'day' });
});

test('a day shows its own total, a week the mean of its finished days', async () => {
  await setup({ ui: { period: 'day' }, meals: { '2026-10-31': { nutrients: { iron: 3 }, incomplete: [] } } });
  expect(screen.getByText('Total du jour')).toBeTruthy();
  expect(row('Fer')).toBe('Fer, 3 mg, 27 % du repère');
});

test('can open on the day without touching the preference, until another period is chosen', async () => {
  const { onUiChange } = await setup({ startOn: 'day', meals: { '2026-10-31': { nutrients: { iron: 3 }, incomplete: [] } } });
  expect(screen.getByText('Total du jour')).toBeTruthy();
  expect(onUiChange).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByText('Semaine'));
  expect(onUiChange).toHaveBeenCalledWith({ period: 'week' });
  expect(screen.queryByText('Total du jour')).toBeNull();
});
