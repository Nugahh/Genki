import { render, screen } from '@testing-library/react-native';
import { processColor } from 'react-native';
import { PaperProvider } from 'react-native-paper';
import { theme } from '@/theme';
import type { Point } from '../domain/metric';
import { metricById } from '../domain/metrics';
import { bucketsFor } from '../domain/period';
import { SeriesChart } from './SeriesChart';

const week = bucketsFor('week', '2026-10-31');
const point = (i: number, patch: Partial<Point>): Point => ({ bucket: week[i], partial: false, tone: 'none', ...patch });
// react-native-svg hands its native views the colors already processed.
const native = (color: string) => ({ type: 0, payload: processColor(color) });
const draw = (ui: React.ReactElement) => render(<PaperProvider theme={theme}>{ui}</PaperProvider>);

describe('bars', () => {
  const calories = metricById('calories')!;
  const points = [point(0, { value: 1900, tone: 'good' }), point(1, { value: 2400, tone: 'bad' }), point(2, {}), point(5, { value: 1200, partial: true })];

  test('draws one bar per bucket that has a value, in the tone of its day', async () => {
    await draw(<SeriesChart def={calories} points={points} goal={2000} />);
    expect(screen.getByTestId(`bar-${week[0].key}`)).toHaveProp('fill', native(theme.colors.pace.green));
    expect(screen.getByTestId(`bar-${week[1].key}`)).toHaveProp('fill', native(theme.colors.pace.red));
    expect(screen.queryByTestId(`bar-${week[2].key}`)).toBeNull();
  });

  test('draws today dashed and unfilled, with no tone', async () => {
    await draw(<SeriesChart def={calories} points={points} goal={2000} />);
    const today = screen.getByTestId(`bar-${week[5].key}`);
    expect(today.props.fill).toBeNull();
    expect(today).toHaveProp('strokeDasharray', [4, 3]);
    expect(today).toHaveProp('stroke', native(theme.colors.chart.calories));
  });

  test('draws the goal line only when there is a goal', async () => {
    const { rerender } = await draw(<SeriesChart def={calories} points={points} goal={2000} />);
    expect(screen.getByTestId('goal-line')).toBeTruthy();
    await rerender(
      <PaperProvider theme={theme}>
        <SeriesChart def={calories} points={points} />
      </PaperProvider>,
    );
    expect(screen.queryByTestId('goal-line')).toBeNull();
  });

  test('a metric with no target keeps its own color', async () => {
    const fat = metricById('fat')!;
    await draw(<SeriesChart def={fat} points={[point(0, { value: 60 })]} />);
    expect(screen.getByTestId(`bar-${week[0].key}`)).toHaveProp('fill', native(theme.colors.chart.fat));
  });

  test('says the same as the picture to a screen reader', async () => {
    await draw(<SeriesChart def={calories} points={points} goal={2000} />);
    const chart = screen.getByRole('image');
    expect(chart.props.accessibilityLabel).toContain('Calories : lundi, ');
    expect(chart.props.accessibilityLabel).toContain('Objectif');
  });
});

describe('a line', () => {
  const weight = metricById('weight')!;

  test('breaks where a day has no record, and marks each value', async () => {
    const points = [point(0, { value: 80 }), point(1, { value: 79.5 }), point(2, {}), point(3, { value: 79 })];
    await draw(<SeriesChart def={weight} points={points} />);
    expect(screen.getAllByTestId(/^line-/)).toHaveLength(1); // one run of two values; the lone value is a marker only
    expect(screen.getAllByTestId(/^dot-/)).toHaveLength(3);
  });

  test('draws today so far as a hollow dot of the line, and dashes the last stretch', async () => {
    const points = [point(0, { value: 80 }), point(1, { value: 79.5 }), point(2, { value: 79, partial: true })];
    await draw(<SeriesChart def={weight} points={points} />);
    expect(screen.getByTestId('line-0')).toBeTruthy();
    expect(screen.getByTestId('line-0-open')).toHaveProp('strokeDasharray', [4, 3]);
    const today = screen.getByTestId(`dot-${week[2].key}`);
    expect(today).toHaveProp('stroke', native(theme.colors.chart.weight));
    expect(today).toHaveProp('strokeWidth', 2);
  });

  test('shrinks the dots of a month so that they do not overlap', async () => {
    const days = bucketsFor('month', '2026-10-15');
    await draw(<SeriesChart def={weight} points={days.map((bucket): Point => ({ bucket, value: 80, partial: false, tone: 'none' }))} />);
    expect(Number(screen.getByTestId(`dot-${days[0].key}`).props.r)).toBeLessThan(4);
  });

  test('says there is no data when nothing was recorded', async () => {
    await draw(<SeriesChart def={weight} points={[point(0, {})]} />);
    expect(screen.getByRole('image').props.accessibilityLabel).toBe('Poids : aucune donnée.');
  });
});

describe('the labels under the bars', () => {
  const calories = metricById('calories')!;
  const empty = (period: 'week' | 'month' | 'year') => bucketsFor(period, '2026-11-15').map((bucket): Point => ({ bucket, partial: false, tone: 'none' }));
  const labelled = () => screen.queryAllByTestId(/^label-/).map((label) => label.props.testID.slice('label-'.length));

  test('a week keeps all seven', async () => {
    await draw(<SeriesChart def={calories} points={empty('week')} />);
    expect(labelled()).toHaveLength(7);
  });

  test('a year keeps one month in two', async () => {
    await draw(<SeriesChart def={calories} points={empty('year')} />);
    expect(labelled()).toEqual(['2026-01', '2026-03', '2026-05', '2026-07', '2026-09', '2026-11']);
  });

  test('a month keeps one day in five', async () => {
    await draw(<SeriesChart def={calories} points={empty('month')} />);
    expect(labelled()).toEqual(['2026-11-01', '2026-11-06', '2026-11-11', '2026-11-16', '2026-11-21', '2026-11-26']);
  });

  test('a month draws one bar per day that has a value, and names them for a screen reader', async () => {
    const points = empty('month').map((p, i) => (i < 3 ? { ...p, value: 2000, tone: 'good' as const } : p));
    await draw(<SeriesChart def={calories} points={points} title="novembre 2026" />);
    expect(screen.getAllByTestId(/^bar-/)).toHaveLength(3);
    expect(screen.getByRole('image').props.accessibilityLabel).toMatch(/1er novembre, 2.000 kcal, dans la cible ; 2 novembre/);
  });
});
