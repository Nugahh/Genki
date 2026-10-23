import { StyleSheet, View } from 'react-native';
import { Icon, Text, TouchableRipple } from 'react-native-paper';
import type { GaugeColor } from '../domain/gauge';

const COLORS: Record<GaugeColor, string> = { green: '#2E7D32', orange: '#EF6C00', red: '#C62828' };

type Props = {
  label: string;
  /** Value shown on the right, e.g. "1,25 / 2,5 L". */
  text: string;
  /** Progress toward the goal; drawn full from 1. */
  progress: number;
  /** Where the user should be by now, from 0 to 1. */
  expected: number;
  color: GaugeColor;
  /** "plus" adds, "chevron-right" opens (spec §6). */
  icon: 'plus' | 'chevron-right';
  onPress: () => void;
};

export function GaugeBar({ label, text, progress, expected, color, icon, onPress }: Props) {
  return (
    <TouchableRipple
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label} : ${text}`}
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
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${Math.min(progress, 1) * 100}%`, backgroundColor: COLORS[color] }]} />
          <View style={[styles.marker, { left: `${expected * 100}%` }]} />
        </View>
      </View>
    </TouchableRipple>
  );
}

const styles = StyleSheet.create({
  touch: { minHeight: 48, borderRadius: 12, padding: 12 },
  content: { gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  track: { height: 12, borderRadius: 6, backgroundColor: '#E0E0E0', overflow: 'hidden' },
  fill: { height: '100%' },
  marker: { position: 'absolute', top: 0, bottom: 0, width: 2, backgroundColor: '#212121' },
});
