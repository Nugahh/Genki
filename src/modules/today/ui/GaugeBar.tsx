import { Animated, StyleSheet, View } from 'react-native';
import { Icon, Surface, Text, TouchableRipple, useTheme } from 'react-native-paper';
import { useFillAnimation } from '@/shared/useFillAnimation';
import type { AppTheme } from '@/theme';
import type { GaugeColor } from '../domain/gauge';

const PACE: Record<GaugeColor, string> = { green: 'dans le rythme', orange: 'un peu en retard', red: 'en retard' };
const METRIC_ICON = { water: 'water', calories: 'fire', protein: 'arm-flex', steps: 'walk' } as const;

type Props = {
  label: string;
  /** The day so far, with its unit, e.g. "1,25 L": the number the screen is read for. */
  value: string;
  /** The goal, with its unit, e.g. "2,5 L". */
  goal: string;
  /** What is left of the goal, or that it is reached or passed, e.g. "reste 1,25 L". */
  remaining: string;
  /** Progress toward the goal; drawn full from 1. */
  progress: number;
  /** Where the user should be by now, from 0 to 1. */
  expected: number;
  color: GaugeColor;
  /** What is measured: its icon (a drop, a flame, a flexed arm) wears the label, on a disc of its own tint. */
  metric: keyof typeof METRIC_ICON;
  /** What a touch does, read by TalkBack after the label: the icon alone says it to the eye. */
  hint: string;
  /** A line under the goal: where the number comes from, when it was last read. */
  note?: string;
  /** What the color means, read by TalkBack: the pace wording unless the gauge has something else to say. */
  status?: string;
  /** "plus" adds, "chevron-right" opens (spec §6). */
  icon: 'plus' | 'chevron-right';
  onPress: () => void;
};

export function GaugeBar({ label, value, goal, remaining, hint, metric, progress, expected, color, status = PACE[color], note, icon, onPress }: Props) {
  const { colors } = useTheme<AppTheme>();
  const fill = useFillAnimation(progress);
  const tint = colors.metric[metric];
  return (
    <Surface mode="flat" elevation={1} style={styles.card}>
      <TouchableRipple
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${label} : ${value}, sur ${goal}, ${remaining}${note ? `, ${note}` : ''}`}
        accessibilityHint={hint}
        accessibilityValue={{ text: status }}
        style={styles.touch}
      >
        <View style={styles.content}>
          <View style={styles.row}>
            <View style={styles.title}>
              <View style={[styles.badge, { backgroundColor: tint.container }]}>
                <Icon source={METRIC_ICON[metric]} size={20} color={tint.on} />
              </View>
              <Text variant="labelLarge" style={[styles.label, { color: colors.onSurfaceVariant }]}>{label}</Text>
            </View>
            <Icon source={icon} size={24} />
          </View>
          <Text variant="headlineSmall" style={styles.value}>{value}</Text>
          <View style={[styles.track, { backgroundColor: colors.surfaceVariant }]}>
            <Animated.View style={[styles.fill, { width: fill.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }), backgroundColor: colors.pace[color] }]} />
            {/* Pulled back by its 2 dp width as it nears 100 %, or the track's overflow would clip it. */}
            <View style={[styles.marker, { backgroundColor: colors.onSurface, left: `${expected * 100}%`, marginLeft: -2 * expected }]} />
          </View>
          <Text variant="bodyMedium" style={{ color: colors.onSurfaceVariant }}>{`sur ${goal} · ${remaining}`}</Text>
          {note && (
            <Text variant="bodySmall" style={{ color: colors.onSurfaceVariant }}>
              {note}
            </Text>
          )}
        </View>
      </TouchableRipple>
    </Surface>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 16 },
  // A soft card: the ripple is clipped to its corners here, since a Surface with overflow hidden loses its shadow.
  touch: { minHeight: 48, padding: 16, borderRadius: 16, overflow: 'hidden' },
  content: { gap: 4 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  title: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  badge: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  label: { flexShrink: 1 },
  // Tabular figures: the digits do not shift as the day's total grows.
  value: { fontVariant: ['tabular-nums'] },
  track: { height: 12, borderRadius: 6, marginVertical: 4, overflow: 'hidden' },
  fill: { height: '100%' },
  marker: { position: 'absolute', top: 0, bottom: 0, width: 2 },
});
