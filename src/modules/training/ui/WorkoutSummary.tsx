import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, Icon, Surface, Text, useTheme } from 'react-native-paper';
import type { WorkoutSummary as Summary } from '../application/trainingUseCases';
import { kgText } from './format';

type Props = { summary: Summary; onDone: () => void };

/** What a finished workout earns: its duration, the loads to aim for next time, the milestones reached. */
export function WorkoutSummary({ summary, onDone }: Props) {
  const { colors } = useTheme();
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.title}>
        <Icon source="check-circle" size={32} color={colors.primary} />
        <Text variant="titleLarge">Séance enregistrée, bravo !</Text>
      </View>
      <Text variant="bodyLarge" style={{ color: colors.onSurfaceVariant }}>{`Durée : ${summary.durationMin} min`}</Text>

      {summary.achieved.length > 0 && (
        <Surface mode="flat" elevation={1} style={styles.card}>
          {summary.achieved.map((m) => (
            <Text key={m.id} variant="titleMedium">{`Palier atteint : ${m.label}`}</Text>
          ))}
        </Surface>
      )}

      {summary.suggestions.length > 0 && (
        <Surface mode="flat" elevation={1} style={styles.card}>
          <Text variant="titleMedium" accessibilityRole="header">
            À viser la prochaine fois
          </Text>
          {summary.suggestions.map((s) => (
            <Text key={s.exerciseId} variant="bodyLarge">{`${s.name} : ${kgText(s.toKg)} la prochaine fois`}</Text>
          ))}
        </Surface>
      )}

      <Button mode="contained" contentStyle={styles.button} onPress={onDone}>
        Retour
      </Button>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 16 },
  title: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  card: { padding: 16, gap: 8, borderRadius: 12 },
  button: { minHeight: 48 },
});
