import { StyleSheet } from 'react-native';
import { Button, Surface, Text } from 'react-native-paper';
import type { TrackingUseCases } from '../application/trackingUseCases';
import { metricById } from '../domain/metrics';
import type { Period } from '../domain/period';
import { useMetricView } from './useMetricView';

type Props = {
  tracking: TrackingUseCases;
  period: Period;
  /** A day of the period shown. */
  day: string;
  /** How many sessions the phase in progress plans for a week, when there is a programme. */
  planned?: number;
  onOpenSport: () => void;
};

function WeekSessions({ tracking, day, planned }: Pick<Props, 'tracking' | 'day' | 'planned'>) {
  const view = useMetricView(tracking, metricById('sessions')!, 'week', day);
  if (!view) return null;
  const done = view.points.reduce((sum, p) => sum + (p.value ?? 0), 0);
  return (
    <Surface mode="flat" elevation={1} style={styles.card}>
      <Text variant="titleMedium">{planned ? `Séances de la semaine : ${done} sur ${planned}` : `Séances de la semaine : ${done}`}</Text>
    </Surface>
  );
}

/** Sessions done against sessions planned (over a week), and the way to the programme and the milestones. */
export function TrainingExtras({ tracking, period, day, planned, onOpenSport }: Props) {
  return (
    <>
      {period === 'week' && <WeekSessions tracking={tracking} day={day} planned={planned} />}
      <Button mode="outlined" icon="dumbbell" contentStyle={styles.button} onPress={onOpenSport}>
        Voir le programme et les paliers
      </Button>
    </>
  );
}

const styles = StyleSheet.create({
  card: { padding: 16, borderRadius: 16 },
  button: { minHeight: 48 },
});
