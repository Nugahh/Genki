import { View } from 'react-native';
import { useTheme } from 'react-native-paper';
import Svg, { Path } from 'react-native-svg';
import type { AppTheme } from '@/theme';
import type { Point, Tint } from '../domain/metric';
import { runsOf } from './chartGeometry';

type Props = { points: Point[]; tint: Tint; width?: number; height?: number };

/** The shape of a metric over the period, without axes: it adds to the number beside it and says nothing a screen reader needs. */
export function MiniCurve({ points, tint, width = 72, height = 32 }: Props) {
  const { colors } = useTheme<AppTheme>();
  // Today so far is left out, as it is from the number beside the curve: a morning at 0 is not a dive.
  const shown = points.map((p) => (p.partial ? { ...p, value: undefined } : p));
  const values = shown.flatMap((p) => (p.value === undefined ? [] : [p.value]));
  const hidden = { importantForAccessibility: 'no-hide-descendants', accessibilityElementsHidden: true } as const;
  if (values.length < 2) return <View testID="mini-curve-box" style={{ width, height }} {...hidden} />;

  const low = Math.min(...values);
  const span = Math.max(Math.max(...values) - low, 1);
  const step = width / Math.max(points.length - 1, 1);
  const y = (value: number) => height - 4 - ((value - low) / span) * (height - 8);
  const d = runsOf(shown)
    .filter((run) => run.length > 1)
    .map((run) => run.map((p, i) => `${i === 0 ? 'M' : 'L'}${(shown.indexOf(p) * step).toFixed(1)},${y(p.value!).toFixed(1)}`).join(' '))
    .join(' ');

  return (
    <View testID="mini-curve-box" style={{ width, height }} {...hidden}>
      <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <Path testID="mini-curve" d={d} fill="none" stroke={colors.chart[tint]} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      </Svg>
    </View>
  );
}
