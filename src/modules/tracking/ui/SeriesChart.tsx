import { useState } from 'react';
import { View } from 'react-native';
import { useTheme } from 'react-native-paper';
import Svg, { Circle, Line, Path, Polyline, Text as SvgText } from 'react-native-svg';
import type { AppTheme } from '@/theme';
import type { MetricDefinition, Point } from '../domain/metric';
import { barPath, runsOf } from './chartGeometry';
import { chartText } from './chartText';

type Props = { def: MetricDefinition; points: Point[]; goal?: number; height?: number };

const PAD = { top: 12, bottom: 24, side: 8 };
const BAR_MAX_WIDTH = 28;
const DASH = [4, 3];
const PACE = { good: 'green', warn: 'orange', bad: 'red' } as const;

/**
 * A metric over a period: bars for what adds up over a day, a line for a measure, with the goal as a dashed line.
 * Thin marks, a round data end, today dashed; the picture is also said in words (`chartText`) for a screen reader.
 */
export function SeriesChart({ def, points, goal, height = 180 }: Props) {
  const { colors } = useTheme<AppTheme>();
  // Measured on layout; the first guess is the width of a phone, so that the first frame is not empty.
  const [width, setWidth] = useState(320);
  const tint = colors.chart[def.tint];
  const base = height - PAD.bottom;
  const plotHeight = base - PAD.top;
  const slot = (width - 2 * PAD.side) / points.length;
  const centre = (i: number) => PAD.side + slot * (i + 0.5);

  const values = points.flatMap((p) => (p.value === undefined ? [] : [p.value]));
  // Bars stand on zero; a line zooms on its own range, with room above and below.
  const lowest = def.kind === 'bars' ? 0 : Math.min(...values, ...(goal ? [goal] : []));
  const highest = Math.max(...values, goal ?? 0, 1);
  const spread = def.kind === 'bars' ? highest : Math.max(highest - lowest, 1);
  const floor = def.kind === 'bars' ? 0 : lowest - spread * 0.2;
  const top = def.kind === 'bars' ? highest * 1.1 : highest + spread * 0.2;
  const y = (value: number) => base - ((value - floor) / (top - floor)) * plotHeight;

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={chartText(def, points, goal)}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
    >
      <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <Line x1={PAD.side} x2={width - PAD.side} y1={base} y2={base} stroke={colors.outlineVariant} strokeWidth={1} />
        {goal ? (
          <>
            <Line testID="goal-line" x1={PAD.side} x2={width - PAD.side} y1={y(goal)} y2={y(goal)} stroke={colors.onSurfaceVariant} strokeWidth={1} strokeDasharray={DASH} />
            <SvgText x={width - PAD.side} y={y(goal) - 4} fontSize={11} fill={colors.onSurfaceVariant} textAnchor="end">
              {`Objectif ${def.format(goal)}`}
            </SvgText>
          </>
        ) : null}

        {def.kind === 'bars'
          ? points.map((p, i) => {
              if (p.value === undefined) return null;
              const w = Math.min(slot * 0.6, BAR_MAX_WIDTH);
              const path = barPath(centre(i) - w / 2, base, w, Math.max(base - y(p.value), 2));
              // A day that is not over has no tone yet: an outline of the metric's color, dashed.
              return p.partial || p.tone === 'none' ? (
                <Path
                  key={p.bucket.key}
                  testID={`bar-${p.bucket.key}`}
                  d={path}
                  fill={p.partial ? 'none' : tint}
                  stroke={tint}
                  strokeWidth={p.partial ? 2 : 0}
                  strokeDasharray={p.partial ? DASH : undefined}
                />
              ) : (
                <Path key={p.bucket.key} testID={`bar-${p.bucket.key}`} d={path} fill={colors.pace[PACE[p.tone]]} />
              );
            })
          : runsOf(points).map((run, r) => (
              <Polyline
                key={r}
                testID={run.length > 1 ? `line-${r}` : undefined}
                points={run.map((p) => `${centre(points.indexOf(p))},${y(p.value!)}`).join(' ')}
                fill="none"
                stroke={tint}
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            ))}
        {def.kind === 'line'
          ? points.map((p, i) =>
              p.value === undefined ? null : (
                <Circle
                  key={p.bucket.key}
                  testID={`dot-${p.bucket.key}`}
                  cx={centre(i)}
                  cy={y(p.value)}
                  r={4}
                  fill={p.partial ? colors.surface : tint}
                  stroke={colors.surface}
                  strokeWidth={p.partial ? 0 : 2}
                />
              ),
            )
          : null}

        {points.map((p, i) => (
          <SvgText key={p.bucket.key} x={centre(i)} y={height - 6} fontSize={11} fill={colors.onSurfaceVariant} textAnchor="middle">
            {p.bucket.label}
          </SvgText>
        ))}
      </Svg>
    </View>
  );
}
