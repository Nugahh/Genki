import { StyleSheet, View } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';
import { Text, useTheme } from 'react-native-paper';
import type { AppTheme } from '@/theme';
import { energySplit } from '../domain/portion';
import { gramsText, kcalText } from './format';

type Props = {
  kcal: number;
  protein: number;
  /** Net carbs: the carbohydrates minus the fibre. */
  carbs: number;
  fat: number;
  /** The fibre is not known, so the net carbs are only the carbohydrates. */
  carbsPartial?: boolean;
};

const SIZE = 128;
const STROKE = 14;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
// A gap of the page's colour between two arcs.
const GAP = 3;

/** The energy of a portion as a ring of three arcs (protein, net carbs, fat), the calories at the centre, and the shares in text beside it. */
export function EnergyRing({ kcal, protein, carbs, fat, carbsPartial = false }: Props) {
  const { colors } = useTheme<AppTheme>();
  const split = energySplit(protein, carbs, fat);
  const parts = [
    { id: 'protein', label: 'Protéines', grams: protein, pct: split?.proteinPct ?? 0, color: colors.chart.protein },
    { id: 'carbs', label: carbsPartial ? 'Glucides nets (partiel)' : 'Glucides nets', grams: carbs, pct: split?.carbsPct ?? 0, color: colors.chart.carbs },
    { id: 'fat', label: 'Lipides', grams: fat, pct: split?.fatPct ?? 0, color: colors.chart.fat },
  ];
  let offset = 0;
  const arcs = parts.map((p) => {
    const length = (CIRCUMFERENCE * p.pct) / 100;
    const arc = { ...p, length: Math.max(0, length - (p.pct < 100 ? GAP : 0)), offset };
    offset += length;
    return arc;
  });
  const said = split
    ? `Énergie : ${kcalText(kcal)} kcal. Protéines ${split.proteinPct} %, glucides nets ${split.carbsPct} %${carbsPartial ? ' (partiel)' : ''}, lipides ${split.fatPct} %.`
    : `Énergie : ${kcalText(kcal)} kcal.`;

  return (
    <View style={styles.row}>
      <View style={styles.ring} accessible accessibilityRole="image" accessibilityLabel={said}>
        <Svg width={SIZE} height={SIZE}>
          <Circle cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} stroke={colors.surfaceVariant} strokeWidth={STROKE} fill="none" />
          <G rotation={-90} origin={`${SIZE / 2}, ${SIZE / 2}`}>
            {arcs
              .filter((a) => a.pct > 0)
              .map((a) => (
                <Circle
                  key={a.id}
                  testID={`arc-${a.id}`}
                  cx={SIZE / 2}
                  cy={SIZE / 2}
                  r={RADIUS}
                  stroke={a.color}
                  strokeWidth={STROKE}
                  fill="none"
                  strokeDasharray={`${a.length} ${CIRCUMFERENCE - a.length}`}
                  strokeDashoffset={-a.offset}
                />
              ))}
          </G>
        </Svg>
        <View style={[StyleSheet.absoluteFill, styles.centre]} pointerEvents="none">
          <Text variant="headlineSmall" style={styles.kcal} numberOfLines={1} adjustsFontSizeToFit>
            {kcalText(kcal)}
          </Text>
          <Text variant="labelMedium" style={{ color: colors.onSurfaceVariant }}>
            kcal
          </Text>
        </View>
      </View>
      <View style={styles.legend}>
        {parts.map((p) => (
          <View key={p.id} style={styles.item}>
            <View style={[styles.dot, { backgroundColor: p.color }]} />
            <View style={styles.text}>
              <Text variant="bodyMedium">{p.label}</Text>
              <Text variant="titleSmall">{`${gramsText(p.grams)} g · ${p.pct} %`}</Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  ring: { width: SIZE, height: SIZE },
  // Inside the ring: its inner circle is about 100 dp wide.
  centre: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: STROKE + 6 },
  kcal: { fontVariant: ['tabular-nums'] },
  legend: { flex: 1, gap: 8 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  text: { flex: 1 },
});
