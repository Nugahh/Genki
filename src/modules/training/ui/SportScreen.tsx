import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, Chip, Surface, Text, useTheme } from 'react-native-paper';
import type { Profile } from '@/modules/settings';
import { ConfirmDialog } from '@/shared/ConfirmDialog';
import { dayKey, type Clock } from '@/shared/clock';
import { useNow } from '@/shared/useNow';
import type { TrainingUseCases } from '../application/trainingUseCases';
import { nextSession, planPosition, type Plan } from '../domain/plan';
import type { WorkoutLog } from '../domain/workout';
import { MilestonesSection } from './MilestonesSection';

type Props = {
  profile: Profile;
  clock: Clock;
  training: TrainingUseCases;
  /** Runs a write; a rejected one is offered again with « Réessayer » (spec §8). */
  run: (write: () => Promise<void>) => void;
  /** A session of the phase in progress is started: its index in that phase. */
  onStart: (sessionIndex: number) => void;
  onEditPlan: () => void;
};

/** The Sport tab: the programme in progress, its sessions, and the milestones. */
export function SportScreen({ profile, clock, training, run, onStart, onEditPlan }: Props) {
  const { colors } = useTheme();
  const day = dayKey(useNow(clock), profile.timezone);
  // null until the first list arrives, so that « Aucun programme » is never a guess.
  const [plans, setPlans] = useState<Plan[] | null>(null);
  const [latest, setLatest] = useState<WorkoutLog | undefined>();
  const [restarting, setRestarting] = useState(false);
  // Listener errors show on the SyncIcon, which watches the same user's data.
  useEffect(() => training.observePlans(setPlans, () => {}), [training]);
  useEffect(() => training.observeLatestWorkout(setLatest, () => {}), [training]);

  if (plans === null) return null;
  const plan = plans.find((p) => p.active);

  if (!plan) {
    return (
      <ScrollView contentContainerStyle={styles.content}>
        <Surface mode="flat" elevation={1} style={styles.card}>
          <Text variant="titleMedium">Aucun programme</Text>
          <Text variant="bodyMedium">Un modèle de trois phases te met sur la voie : tu pourras le modifier ensuite, exercice par exercice.</Text>
          <Text variant="bodyMedium" style={{ color: colors.onSurfaceVariant }}>
            Ce modèle est un point de départ à adapter. Consulte un professionnel avant de reprendre une activité intense.
          </Text>
          <Button mode="contained" contentStyle={styles.button} onPress={() => run(() => training.startFromTemplate())}>
            Partir du modèle
          </Button>
        </Surface>
      </ScrollView>
    );
  }

  const position = planPosition(plan, day);
  const phase = 'finished' in position ? undefined : plan.phases[position.phaseIndex];
  const next = phase ? nextSession(phase, latest?.sessionName) : undefined;
  const exercises = [...new Map(plan.phases.flatMap((p) => p.sessions.flatMap((s) => s.exercises)).map((e) => [e.exerciseId, e.name])).entries()].map(([exerciseId, name]) => ({ exerciseId, name }));

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.title}>
        <Text variant="titleLarge">{plan.name}</Text>
        <Text variant="bodyLarge" style={{ color: colors.onSurfaceVariant }}>
          {phase && !('finished' in position) ? `Phase ${position.phaseIndex + 1} — ${phase.name} · semaine ${position.week} sur ${phase.weeks}` : 'Programme terminé'}
        </Text>
      </View>

      {phase?.sessions.map((session, index) => (
        <Surface key={session.name} mode="flat" elevation={1} style={styles.card} testID={`session-${index}`}>
          <View style={styles.sessionHead}>
            <View style={styles.sessionName}>
              {session === next && (
                <Chip compact accessibilityRole="text" style={styles.next}>
                  Prochaine
                </Chip>
              )}
              <Text variant="titleMedium">{session.name}</Text>
              <Text variant="bodyMedium" style={{ color: colors.onSurfaceVariant }}>{`${session.exercises.length} exercices`}</Text>
            </View>
            <Button mode="contained-tonal" icon="play" accessibilityLabel={`Démarrer ${session.name}`} contentStyle={styles.button} onPress={() => onStart(index)}>
              Démarrer
            </Button>
          </View>
        </Surface>
      ))}

      <View style={styles.actions}>
        <Button mode="outlined" icon="pencil" contentStyle={styles.button} onPress={onEditPlan}>
          Modifier le programme
        </Button>
        <Button icon="restart" contentStyle={styles.button} onPress={() => setRestarting(true)}>
          Repartir du modèle
        </Button>
      </View>

      <MilestonesSection training={training} exercises={exercises} timezone={profile.timezone} run={run} />

      {restarting && (
        <ConfirmDialog
          title="Remplacer le programme ?"
          confirmLabel="Remplacer"
          onCancel={() => setRestarting(false)}
          onConfirm={() => {
            run(() => training.startFromTemplate(plan));
            setRestarting(false);
          }}
        />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 16 },
  title: { gap: 4, paddingHorizontal: 4 },
  card: { padding: 16, gap: 12, borderRadius: 12 },
  sessionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  sessionName: { flexShrink: 1, gap: 2, alignItems: 'flex-start' },
  next: { marginBottom: 4 },
  actions: { gap: 8 },
  button: { minHeight: 48 },
});
