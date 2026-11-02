import { Animated, StyleSheet, View } from 'react-native';
import { Icon, Text, useTheme } from 'react-native-paper';
import { useFillAnimation } from '@/shared/useFillAnimation';
import type { AppTheme } from '@/theme';
import { gramsText, kcalText } from './format';

// The icons of the home gauges for the calories and the protein; a grain of wheat for the carbs, a drop of oil for the fat.
const ICONS = { calories: 'fire', protein: 'arm-flex', carbs: 'barley', fat: 'oil' } as const;

type Props = {
  metric: keyof typeof ICONS;
  label: string;
  value: number;
  goal: number;
  unit: 'kcal' | 'g';
};

/**
 * One macro of the day against its goal: its icon on a disc of its own tint, « Énergie – 700 / 2 200 kcal », and a bar with the percentage to its right.
 * The bar is the hue of the macro, not a pace: a pace needs the hour of the day, and the day's macros need only the total.
 */
export function MacroGauge({ metric, label, value, goal, unit }: Props) {
  const { colors } = useTheme<AppTheme>();
  const progress = goal > 0 ? value / goal : 0;
  const percent = Math.round(progress * 100);
  const fill = useFillAnimation(progress);
  const text = unit === 'kcal' ? kcalText : gramsText;
  const tint = colors.metric[metric];

  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={`${label} : ${text(value)} sur ${text(goal)} ${unit}, ${percent} %${progress > 1 ? ', au-dessus de l’objectif' : ''}`}
      accessibilityValue={{ min: 0, max: 100, now: Math.min(percent, 100), text: `${percent} %` }}
      style={styles.row}
    >
      <View testID={`macro-badge-${metric}`} style={[styles.badge, { backgroundColor: tint.container }]}>
        <Icon source={ICONS[metric]} size={20} color={tint.on} />
      </View>
      <View style={styles.body}>
        <Text variant="titleMedium" style={styles.figures}>{`${label} – ${text(value)} / ${text(goal)} ${unit}`}</Text>
        <View style={styles.barRow}>
          <View style={[styles.track, { backgroundColor: colors.surfaceVariant }]}>
            <Animated.View style={[styles.fill, { width: fill.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }), backgroundColor: colors.chart[metric] }]} />
          </View>
          <Text variant="labelLarge" style={[styles.percent, { color: colors.onSurfaceVariant }]}>{`${percent} %`}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48 },
  badge: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, gap: 4 },
  // Tabular figures: the digits do not shift as the day's total grows.
  figures: { fontVariant: ['tabular-nums'] },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  track: { flex: 1, height: 12, borderRadius: 6, overflow: 'hidden' },
  fill: { height: '100%' },
  // Room for « 125 % » at a larger font, right-aligned so the bars keep one length.
  percent: { minWidth: 48, textAlign: 'right', fontVariant: ['tabular-nums'] },
});
