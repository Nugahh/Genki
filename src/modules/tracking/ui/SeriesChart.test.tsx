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
    expect(chart.props.accessibilityLabel).toContain('Calories : lun. 1');
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

  test('says there is no data when nothing was recorded', async () => {
    await draw(<SeriesChart def={weight} points={[point(0, {})]} />);
    expect(screen.getByRole('image').props.accessibilityLabel).toBe('Poids : aucune donnée.');
  });
});
