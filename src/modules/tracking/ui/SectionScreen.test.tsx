import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import { Text } from 'react-native';
import { PaperProvider } from 'react-native-paper';
import type { UiPrefs } from '@/modules/settings';
import { theme } from '@/theme';
import { inMemoryFactsSource } from '../adapters/inMemoryFactsSource';
import { trackingUseCases } from '../application/trackingUseCases';
import type { DayFacts, SectionId } from '../domain/metric';
import { metricById } from '../domain/metrics';
import { SectionScreen } from './SectionScreen';

const goals = { kcal: 2000, proteinG: 100, waterMl: 2500, steps: 8000 };
const clock = { now: () => new Date('2026-10-31T10:00:00Z') }; // Saturday 31 October
const calories = metricById('calories')!;

const WEEK_FACTS: Record<string, DayFacts> = {
  '2026-10-19': { kcal: 1500, proteinG: 70 },
  '2026-10-26': { kcal: 2000, proteinG: 120 },
  '2026-10-27': { kcal: 1900, proteinG: 60 },
  '2026-10-28': { kcal: 2600, proteinG: 90 },
};

async function setup(props: { section?: SectionId; metricId?: string; ui?: UiPrefs; facts?: Record<string, DayFacts>; renderExtras?: React.ComponentProps<typeof SectionScreen>['renderExtras'] } = {}) {
  const tracking = trackingUseCases({ sources: { days: inMemoryFactsSource(props.facts ?? WEEK_FACTS), training: inMemoryFactsSource(), tobacco: inMemoryFactsSource() }, clock, timezone: 'Europe/Paris' });
  const onUiChange = jest.fn();
  await render(
    <PaperProvider theme={theme}>
      <SectionScreen
        section={props.section ?? 'nutrition'}
        metricId={props.metricId}
        tracking={tracking}
        goals={goals}
        ui={props.ui ?? {}}
        onUiChange={onUiChange}
        clock={clock}
        timezone="Europe/Paris"
        renderExtras={props.renderExtras}
      />
    </PaperProvider>,
  );
  return { onUiChange };
}

const chartLabel = () => screen.getByRole('image').props.accessibilityLabel as string;

test('opens on the requested statistic, and a chip switches to another of the section', async () => {
  await setup({ metricId: 'protein' });
  expect(chartLabel()).toMatch(/^Protéines, Semaine du 26 oct\. au 1 nov\. : /);
  await fireEvent.press(screen.getByText('Calories'));
  expect(chartLabel()).toMatch(/^Calories, Semaine du 26 oct\. au 1 nov\. : /);
  expect(screen.getByText('Lipides')).toBeTruthy();
});

test('opens on the first statistic of the section when none is asked for', async () => {
  await setup();
  expect(chartLabel()).toMatch(/^Calories, Semaine du 26 oct\. au 1 nov\. : /);
});

test('a section with one statistic has no chips', async () => {
  await setup({ section: 'eau', facts: { '2026-10-26': { waterMl: 2000 } } });
  expect(chartLabel()).toMatch(/^Eau, Semaine du 26 oct\. au 1 nov\. : /);
  expect(screen.queryByText('Calories')).toBeNull();
});

test('sums up the week: the average, the days on target, the best day', async () => {
  await setup();
  expect(screen.getByText('Semaine du 26 oct. au 1 nov.')).toBeTruthy();
  const summary = within(screen.getByTestId('summary'));
  expect(summary.getByText(calories.format(2166.6666667))).toBeTruthy();
  expect(summary.getByText('2 sur 3')).toBeTruthy();
  expect(summary.getByText(`${calories.format(2000)} · lundi 26 octobre`)).toBeTruthy();
});

test('goes back one week at a time, and not forward past the present', async () => {
  await setup();
  expect(screen.getByLabelText('Période suivante')).toBeDisabled();
  await fireEvent.press(screen.getByLabelText('Période précédente'));
  expect(screen.getByText('Semaine du 19 oct. au 25 oct.')).toBeTruthy();
  expect(within(screen.getByTestId('summary')).getByText(calories.format(1500))).toBeTruthy();
  expect(screen.getByLabelText('Période suivante')).toBeEnabled();
  await fireEvent.press(screen.getByLabelText('Période suivante'));
  expect(screen.getByText('Semaine du 26 oct. au 1 nov.')).toBeTruthy();
});

test('the period is chosen here and kept in the preferences', async () => {
  const { onUiChange } = await setup();
  await fireEvent.press(screen.getByText('Jour'));
  expect(onUiChange).toHaveBeenCalledWith({ period: 'day' });
});

test('says what to do when nothing was recorded in the period', async () => {
  await setup({ facts: {} });
  expect(screen.getByText(calories.emptyHint)).toBeTruthy();
  expect(screen.queryByTestId('summary')).toBeNull();
});

test('in the day view, gives the value of a measure against the day before', async () => {
  await setup({ section: 'corps', ui: { period: 'day' }, facts: { '2026-10-30': { weightKg: 80 }, '2026-10-31': { weightKg: 79.5 } } });
  expect(screen.getByText('samedi 31 octobre')).toBeTruthy();
  const day = within(screen.getByTestId('summary'));
  expect(day.getByText(metricById('weight')!.format(79.5))).toBeTruthy();
  expect(day.getByText(`−${metricById('weight')!.format(0.5)} par rapport à la veille`)).toBeTruthy();
});

test('in the day view, a total still adding up is not compared with a whole day', async () => {
  await setup({ ui: { period: 'day' }, facts: { '2026-10-30': { kcal: 1800 }, '2026-10-31': { kcal: 150 } } });
  const day = within(screen.getByTestId('summary'));
  expect(day.getByText(calories.format(150))).toBeTruthy();
  expect(day.queryByText(/par rapport à/)).toBeNull();
});

test('a week that holds only today shows the bar of the day but no empty summary', async () => {
  await setup({ facts: { '2026-10-31': { kcal: 300 } } });
  expect(screen.getByRole('image')).toBeTruthy();
  expect(screen.queryByTestId('summary')).toBeNull();
});

test('keeps following the clock: left open overnight, a section opens on the new day', async () => {
  // The clock ticks from the moment the screen is mounted.
  jest.useFakeTimers();
  try {
    let now = new Date('2026-10-31T10:00:00Z');
    const moving = { now: () => now };
    const tracking = trackingUseCases({ sources: { days: inMemoryFactsSource(WEEK_FACTS), training: inMemoryFactsSource(), tobacco: inMemoryFactsSource() }, clock: moving, timezone: 'Europe/Paris' });
    await render(
      <PaperProvider theme={theme}>
        <SectionScreen section="nutrition" tracking={tracking} goals={goals} ui={{ period: 'day' }} onUiChange={() => {}} clock={moving} timezone="Europe/Paris" />
      </PaperProvider>,
    );
    expect(screen.getByText('samedi 31 octobre')).toBeTruthy();
    now = new Date('2026-11-01T10:00:00Z');
    await act(async () => {
      jest.advanceTimersByTime(60_000);
    });
    expect(screen.getByText('dimanche 1 novembre')).toBeTruthy();
  } finally {
    jest.useRealTimers();
  }
});

test('hands the period and the day to the extras of the section', async () => {
  await setup({ renderExtras: ({ period, day }) => <Text>{`extras ${period} ${day}`}</Text> });
  expect(screen.getByText('extras week 2026-10-31')).toBeTruthy();
});
