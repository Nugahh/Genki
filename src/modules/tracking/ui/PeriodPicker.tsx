import { StyleSheet, View } from 'react-native';
import { IconButton, SegmentedButtons, Text } from 'react-native-paper';
import type { Period } from '../domain/period';

type Props = {
  period: Period;
  onPeriod: (period: Period) => void;
  /** What the period is, e.g. « Semaine du 26 oct. au 1 nov. ». */
  title: string;
  /** The arrows to earlier and later periods; without it only the title shows. */
  onShift?: (step: -1 | 1) => void;
  canGoForward?: boolean;
};

// Paper's segment is 40 dp tall: 4 dp of padding above and below the label make the 48 dp target.
const option = (value: Period, label: string) => ({ value, label, labelStyle: { paddingVertical: 4 }, showSelectedCheck: true });
const PERIODS = [option('day', 'Jour'), option('week', 'Semaine'), option('month', 'Mois'), option('year', 'Année')];
// Two rows of two, as in add-food: four in a row leave « Semaine » 6 dp short on a 360 dp phone, and no room for the check.
const ROWS = [PERIODS.slice(0, 2), PERIODS.slice(2)];

/** Day, week, month or year (shared by every Suivi screen), and which one: with arrows to go back in time. */
export function PeriodPicker({ period, onPeriod, title, onShift, canGoForward = false }: Props) {
  return (
    <View style={styles.box}>
      <View style={styles.segments}>
        {ROWS.map((buttons, i) => (
          <SegmentedButtons key={i} value={period} onValueChange={(value) => onPeriod(value as Period)} buttons={buttons} />
        ))}
      </View>
      <View style={styles.row}>
        {onShift && <IconButton icon="chevron-left" style={styles.iconButton} accessibilityLabel="Période précédente" onPress={() => onShift(-1)} />}
        <Text variant="titleMedium" accessibilityLiveRegion="polite" style={styles.title}>
          {title}
        </Text>
        {onShift && <IconButton icon="chevron-right" style={styles.iconButton} accessibilityLabel="Période suivante" disabled={!canGoForward} onPress={() => onShift(1)} />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: 8 },
  segments: { gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  title: { flexShrink: 1, textAlign: 'center' },
  // Paper's icon button is 40 dp, and its container clips the extra hit area: 48 dp make the touch target.
  iconButton: { width: 48, height: 48, borderRadius: 24 },
});
