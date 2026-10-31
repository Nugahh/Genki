import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, IconButton, List, Surface, Text, useTheme } from 'react-native-paper';
import { ConfirmDialog } from '@/shared/ConfirmDialog';
import type { TrainingUseCases } from '../application/trainingUseCases';
import type { Milestone } from '../domain/milestone';
import { MilestoneForm } from './MilestoneForm';

type Props = {
  training: TrainingUseCases;
  /** The exercises of the programme, once each. */
  exercises: { exerciseId: string; name: string }[];
  timezone: string;
  run: (write: () => Promise<void>) => void;
};

/** The milestones (paliers): numbers to reach on an exercise, reached when a workout crosses them. */
export function MilestonesSection({ training, exercises, timezone, run }: Props) {
  const { colors } = useTheme();
  const [milestones, setMilestones] = useState<Milestone[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<Milestone | null>(null);
  useEffect(() => training.observeMilestones(setMilestones, () => {}), [training]);

  const date = (at: Date) => at.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', timeZone: timezone });

  return (
    <Surface mode="flat" elevation={1} style={styles.card}>
      <Text variant="titleMedium" accessibilityRole="header">
        Paliers
      </Text>
      {milestones?.length === 0 && <Text>Aucun palier pour l’instant.</Text>}
      {milestones?.map((milestone) => (
        <View key={milestone.id} style={styles.row}>
          <List.Item
            style={styles.item}
            title={milestone.label}
            titleNumberOfLines={2}
            description={milestone.achievedAt ? `Atteint le ${date(milestone.achievedAt)}` : 'À atteindre'}
            left={(props) => <List.Icon {...props} icon={milestone.achievedAt ? 'check-circle' : 'flag-outline'} color={milestone.achievedAt ? colors.primary : props.color} />}
          />
          <IconButton icon="delete-outline" style={styles.iconButton} accessibilityLabel={`Supprimer le palier ${milestone.label}`} onPress={() => setRemoving(milestone)} />
        </View>
      ))}
      <Button icon="plus" contentStyle={styles.button} onPress={() => setAdding(true)}>
        Ajouter un palier
      </Button>

      {adding && (
        <MilestoneForm
          exercises={exercises}
          onCancel={() => setAdding(false)}
          onAdd={(milestone) => {
            run(() => training.addMilestone(milestone));
            setAdding(false);
          }}
        />
      )}
      {removing && (
        <ConfirmDialog
          title={`Supprimer le palier ${removing.label} ?`}
          confirmLabel="Supprimer"
          onCancel={() => setRemoving(null)}
          onConfirm={() => {
            run(() => training.removeMilestone(removing.id));
            setRemoving(null);
          }}
        />
      )}
    </Surface>
  );
}

const styles = StyleSheet.create({
  card: { padding: 16, gap: 8, borderRadius: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  item: { flex: 1 },
  // Paper's icon button is 40 dp, and its container clips the extra hit area: 48 dp make the touch target.
  iconButton: { width: 48, height: 48, borderRadius: 24 },
  button: { minHeight: 48 },
});
