import { StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import type { AppTheme } from '@/theme';
import { gramsText, kcalText } from './format';

type Amounts = { kcal: number; protein: number; carbs: number; fat: number };
type Props = {
  /** What the chosen day holds already (carbs: net). */
  day: Amounts;
  /** What the portion adds. */
  portion: Amounts;
  goals: { kcal: number; proteinG: number; carbsNetG: number; fatG: number };
};

/** The macro goals « avec cette portion »: the day with the portion added, against each goal, in text and in a thin bar. */
export function GoalsWithPortion({ day, portion, goals }: Props) {
  const { colors } = useTheme<AppTheme>();
  const rows = [
    { label: 'Énergie', unit: 'kcal', total: day.kcal + portion.kcal, goal: goals.kcal, text: kcalText, color: colors.chart.calories },
    { label: 'Protéines', unit: 'g', total: day.protein + portion.protein, goal: goals.proteinG, text: gramsText, color: colors.chart.protein },
    { label: 'Glucides nets', unit: 'g', total: day.carbs + portion.carbs, goal: goals.carbsNetG, text: gramsText, color: colors.chart.carbs },
    { label: 'Lipides', unit: 'g', total: day.fat + portion.fat, goal: goals.fatG, text: gramsText, color: colors.chart.fat },
  ];
  return (
    <View style={styles.box}>
      <Text variant="titleMedium" accessibilityRole="header">
        Objectifs avec cette portion
      </Text>
      {rows.map((r) => {
        const over = r.total > r.goal;
        return (
          <View
            key={r.label}
            style={styles.row}
            accessible
            accessibilityLabel={`${r.label} : ${r.text(r.total)} sur ${r.text(r.goal)} ${r.unit} avec cette portion${over ? ', au-dessus de l’objectif' : ''}`}
          >
            <View style={styles.line}>
              <Text variant="bodyMedium">{r.label}</Text>
              <Text variant="titleSmall">{`${r.text(r.total)} / ${r.text(r.goal)} ${r.unit}`}</Text>
            </View>
            <View style={[styles.track, { backgroundColor: colors.surfaceVariant }]}>
              <View style={{ width: `${r.goal > 0 ? Math.min(100, (r.total / r.goal) * 100) : 0}%`, height: 6, borderRadius: 3, backgroundColor: r.color }} />
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: 8 },
  row: { gap: 4 },
  line: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  track: { height: 6, borderRadius: 3 },
});
