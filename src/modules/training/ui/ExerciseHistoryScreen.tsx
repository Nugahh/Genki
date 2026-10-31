import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { Surface, Text, useTheme } from 'react-native-paper';
import type { TrainingUseCases } from '../application/trainingUseCases';
import type { WorkoutLog } from '../domain/workout';
import { setsText } from './format';

type Props = { training: TrainingUseCases; exerciseId: string; name: string };

// A day key has no time zone: noon UTC, read in UTC, is that very day wherever the phone is.
const dayText = (day: string) => new Date(`${day}T12:00:00Z`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });

/** The workouts that held an exercise, newest first, with the sets of that exercise only. */
export function ExerciseHistoryScreen({ training, exerciseId, name }: Props) {
  const { colors } = useTheme();
  const [logs, setLogs] = useState<WorkoutLog[] | null>(null);
  useEffect(() => {
    let stale = false;
    void training.exerciseHistory(exerciseId).then((found) => {
      if (!stale) setLogs(found);
    });
    return () => {
      stale = true;
    };
  }, [training, exerciseId]);

  if (logs === null) return null;
  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text variant="titleLarge">{name}</Text>
      {logs.length === 0 && <Text variant="bodyLarge" style={{ color: colors.onSurfaceVariant }}>Aucune séance pour cet exercice.</Text>}
      {logs.map((log) => (
        <Surface key={log.id} mode="flat" elevation={1} style={styles.card}>
          <Text variant="titleMedium" testID="history-day">
            {dayText(log.day)}
          </Text>
          <Text variant="bodyLarge">{setsText(log.sets.filter((s) => s.exerciseId === exerciseId))}</Text>
        </Surface>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 16 },
  card: { padding: 16, gap: 4, borderRadius: 12 },
});
