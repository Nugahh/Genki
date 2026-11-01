import { StyleSheet, View } from 'react-native';
import { Button, Surface, Text, useTheme } from 'react-native-paper';
import type { AppTheme } from '@/theme';
import type { MetricView } from '../application/trackingUseCases';

type Props = { split: MetricView['split']; onOpenJournal: () => void; onOpenMicro: () => void };

/** Where the energy of the period came from, and the way to the micronutrients and to the journal. */
// shortcut: the journal opens on the current day only; there is no journal of a past day to open.
export function NutritionExtras({ split, onOpenJournal, onOpenMicro }: Props) {
  const { colors } = useTheme<AppTheme>();
  const parts = split
    ? [
        { label: 'Protéines', pct: split.proteinPct, color: colors.chart.protein },
        { label: 'Glucides', pct: split.carbsPct, color: colors.chart.carbs },
        { label: 'Lipides', pct: split.fatPct, color: colors.chart.fat },
      ]
    : [];
  return (
    <>
      {split && (
        <Surface mode="flat" elevation={1} style={styles.card}>
          <Text variant="titleMedium" accessibilityRole="header">
            Répartition de l’énergie
          </Text>
          <View style={styles.bar}>
            {parts.filter((p) => p.pct > 0).map((p) => (
              <View key={p.label} style={{ flex: p.pct, backgroundColor: p.color }} />
            ))}
          </View>
          {parts.map((p) => (
            <View key={p.label} style={styles.row}>
              <View style={[styles.dot, { backgroundColor: p.color }]} />
              <Text variant="bodyLarge" style={styles.label}>
                {p.label}
              </Text>
              <Text variant="titleMedium">{`${p.pct} %`}</Text>
            </View>
          ))}
        </Surface>
      )}
<Button mode="outlined" icon="leaf" contentStyle={styles.button} onPress={onOpenMicro}>
        Micronutriments
      </Button>
      <Button mode="outlined" icon="silverware-fork-knife" contentStyle={styles.button} onPress={onOpenJournal}>
        Ouvrir le journal du jour
      </Button>
    </>
  );
}

const styles = StyleSheet.create({
  card: { padding: 16, gap: 8, borderRadius: 16 },
  // A thin bar, its segments apart by a gap of the page's color.
  bar: { flexDirection: 'row', height: 12, gap: 2, borderRadius: 6, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  label: { flex: 1 },
  button: { minHeight: 48 },
});
