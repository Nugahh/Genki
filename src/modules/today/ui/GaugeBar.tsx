import { StyleSheet } from 'react-native';
import { Icon, Surface, Text, TouchableRipple, useTheme } from 'react-native-paper';
import { GaugeRow } from '@/shared/GaugeRow';
import type { AppTheme } from '@/theme';
import type { GaugeColor } from '../domain/gauge';

const PACE: Record<GaugeColor, string> = { green: 'dans le rythme', orange: 'un peu en retard', red: 'en retard' };
const METRIC_ICON = { water: 'water', calories: 'fire', protein: 'arm-flex', steps: 'walk' } as const;

type Props = {
  label: string;
  /** The day so far, without its unit, e.g. "1,25". */
  value: string;
  /** The goal, without its unit, e.g. "2,5". */
  goal: string;
  /** The unit, shown once after the goal ("L", "kcal", "g"); none when the label says it (the steps). */
  unit?: string;
  /** Progress toward the goal, from 0; the bar is full from 1 and the percentage says how far past it. */
  progress: number;
  /** Where the user should be by now, from 0 to 1. */
  expected: number;
  color: GaugeColor;
  /** What is measured: its icon (a drop, a flame, a flexed arm) wears the title, on a disc of its own tint. */
  metric: keyof typeof METRIC_ICON;
  /** What a touch does, read by TalkBack after the label: the icon alone says it to the eye. */
  hint: string;
  /** A line under the bar: where the number comes from, when it was last read. */
  note?: string;
  /** What the color means, read by TalkBack: the pace wording unless the gauge has something else to say. */
  status?: string;
  /** "plus" adds, "chevron-right" opens (spec §6). */
  icon: 'plus' | 'chevron-right';
  onPress: () => void;
};

/** A measure of the day against its goal, as a soft card that can be pressed: the layout of every gauge of the app, with a pace on the bar. */
export function GaugeBar({ label, value, goal, unit, hint, metric, progress, expected, color, status = PACE[color], note, icon, onPress }: Props) {
  const { colors } = useTheme<AppTheme>();
  const figures = `${value} / ${goal}${unit ? ` ${unit}` : ''}`;
  return (
    <Surface mode="flat" elevation={1} style={styles.card}>
      <TouchableRipple
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${label} : ${value} sur ${goal}${unit ? ` ${unit}` : ''}, ${Math.round(progress * 100)} %${note ? `, ${note}` : ''}`}
        accessibilityHint={hint}
        accessibilityValue={{ text: status }}
        style={styles.touch}
      >
        <GaugeRow
          icon={METRIC_ICON[metric]}
          tint={colors.metric[metric]}
          title={`${label} – ${figures}`}
          progress={progress}
          fillColor={colors.pace[color]}
          marker={expected}
          trailing={<Icon source={icon} size={24} />}
        >
          {note && (
            <Text variant="bodySmall" style={{ color: colors.onSurfaceVariant }}>
              {note}
            </Text>
          )}
        </GaugeRow>
      </TouchableRipple>
    </Surface>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 16 },
  // A soft card: the ripple is clipped to its corners here, since a Surface with overflow hidden loses its shadow.
  touch: { minHeight: 48, padding: 16, borderRadius: 16, overflow: 'hidden' },
});
