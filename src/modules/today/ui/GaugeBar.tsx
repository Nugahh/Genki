import { StyleSheet, View } from 'react-native';
import { Icon, Text, TouchableRipple, useTheme } from 'react-native-paper';
import type { AppTheme } from '@/theme';
import type { GaugeColor } from '../domain/gauge';

const PACE: Record<GaugeColor, string> = { green: 'dans le rythme', orange: 'un peu en retard', red: 'en retard' };

type Props = {
  label: string;
  /** Value shown on the right, e.g. "1,25 / 2,5 L". */
  text: string;
  /** Progress toward the goal; drawn full from 1. */
  progress: number;
  /** Where the user should be by now, from 0 to 1. */
  expected: number;
  color: GaugeColor;
  /** What the color means, read by TalkBack: the pace wording unless the gauge has something else to say. */
  status?: string;
  /** "plus" adds, "chevron-right" opens (spec §6). */
  icon: 'plus' | 'chevron-right';
  onPress: () => void;
};

export function GaugeBar({ label, text, progress, expected, color, status = PACE[color], icon, onPress }: Props) {
  const { colors } = useTheme<AppTheme>();
  return (
    <TouchableRipple
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label} : ${text}`}
      accessibilityValue={{ text: status }}
      style={styles.touch}
    >
      <View style={styles.content}>
        <View style={styles.row}>
          <Text variant="titleMedium">{label}</Text>
          <View style={styles.row}>
            <Text variant="bodyLarge">{text}</Text>
            <Icon source={icon} size={24} />
          </View>
        </View>
        <View style={[styles.track, { backgroundColor: colors.surfaceVariant }]}>
          <View style={[styles.fill, { width: `${Math.min(progress, 1) * 100}%`, backgroundColor: colors.pace[color] }]} />
          {/* Pulled back by its 2 dp width as it nears 100 %, or the track's overflow would clip it. */}
          <View style={[styles.marker, { backgroundColor: colors.onSurface, left: `${expected * 100}%`, marginLeft: -2 * expected }]} />
        </View>
      </View>
    </TouchableRipple>
  );
}

const styles = StyleSheet.create({
  touch: { minHeight: 48, borderRadius: 12, padding: 12 },
  content: { gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  track: { height: 12, borderRadius: 6, overflow: 'hidden' },
  fill: { height: '100%' },
  marker: { position: 'absolute', top: 0, bottom: 0, width: 2 },
});
