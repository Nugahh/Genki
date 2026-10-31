import { render, screen } from '@testing-library/react-native';
import { processColor } from 'react-native';
import { PaperProvider } from 'react-native-paper';
import { theme } from '@/theme';
import type { Point } from '../domain/metric';
import { bucketsFor } from '../domain/period';
import { MiniCurve } from './MiniCurve';

const week = bucketsFor('week', '2026-10-31');
const point = (i: number, value?: number): Point => ({ bucket: week[i], value, partial: false, tone: 'none' });
// The curve is hidden from screen readers on purpose: look at it all the same.
const hidden = { includeHiddenElements: true };
const draw = (points: Point[]) =>
  render(
    <PaperProvider theme={theme}>
      <MiniCurve points={points} tint="water" />
    </PaperProvider>,
  );

test('draws the curve in the tint of its metric, and hides it from screen readers', async () => {
  await draw([point(0, 1), point(1, 3), point(2, 2)]);
  expect(screen.getByTestId('mini-curve', hidden)).toHaveProp('stroke', { type: 0, payload: processColor(theme.colors.chart.water) });
  expect(screen.getByTestId('mini-curve-box', hidden)).toHaveProp('importantForAccessibility', 'no-hide-descendants');
});

test('draws nothing for a lone value or none', async () => {
  await draw([point(0, 1)]);
  expect(screen.queryByTestId('mini-curve', hidden)).toBeNull();
});
