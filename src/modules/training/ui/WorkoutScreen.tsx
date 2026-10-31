import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, IconButton, Surface, Text, TextInput, useTheme } from 'react-native-paper';
import type { Profile } from '@/modules/settings';
import { dayKey, type Clock } from '@/shared/clock';
import type { DraftExercise, TrainingUseCases, WorkoutSummary as Summary } from '../application/trainingUseCases';
import { planPosition, type Plan } from '../domain/plan';
import type { LoggedSet } from '../domain/workout';
import { asText, kgText, parseNumber, setsText } from './format';
import { RestTimer } from './RestTimer';
import { WorkoutSummary } from './WorkoutSummary';

type Props = {
  profile: Profile;
  clock: Clock;
  training: TrainingUseCases;
  /** The session to do: its index in the phase in progress. */
  sessionIndex: number;
  /** Runs a write; a rejected one is offered again with « Réessayer » (spec §8). */
  run: (write: () => Promise<void>) => void;
  onDone: () => void;
  /** Whether leaving would lose sets already ticked off: the host asks before it lets the user go. */
  onDirtyChange: (dirty: boolean) => void;
};

type Row = { kg: string; reps: string; done: boolean };

const inRange = (n: number, integer: boolean) => (integer ? Number.isInteger(n) : Number.isFinite(n)) && n >= 0 && n <= 1000;
const rowIsValid = (row: Row) => inRange(parseNumber(row.kg), false) && inRange(parseNumber(row.reps), true);

/** A session being done: the sets to fill in (the load to aim for already in), a rest timer, then what the workout earns. */
export function WorkoutScreen({ profile, clock, training, sessionIndex, run, onDone, onDirtyChange }: Props) {
  const { colors } = useTheme();
  const day = dayKey(clock.now(), profile.timezone);
  // undefined while loading; null when there is no programme.
  const [plan, setPlan] = useState<Plan | null | undefined>(undefined);
  const [draft, setDraft] = useState<DraftExercise[] | null>(null);
  const [rows, setRows] = useState<Row[][]>([]);
  const [restSince, setRestSince] = useState<number | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [startedAt] = useState(() => clock.now());

  // The programme is read once: a later snapshot must not replace the sets being typed.
  useEffect(() => {
    let first = true;
    return training.observePlans((plans) => {
      if (!first) return;
      first = false;
      setPlan(plans.find((p) => p.active) ?? null);
    }, () => {});
  }, [training]);

  const position = plan ? planPosition(plan, day) : undefined;
  const session = plan && position && !('finished' in position) ? plan.phases[position.phaseIndex].sessions[sessionIndex] : undefined;
  useEffect(() => {
    if (!session) return;
    let stale = false;
    void training.startWorkout(session).then((exercises) => {
      if (stale) return;
      setDraft(exercises);
      setRows(exercises.map((d) => d.sets.map((s) => ({ kg: asText(s.kg), reps: asText(s.reps), done: false }))));
    });
    return () => {
      stale = true;
    };
  }, [training, session]);

  const dirty = summary === null && rows.some((exercise) => exercise.some((row) => row.done));
  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);

  if (summary) return <WorkoutSummary summary={summary} onDone={onDone} />;
  if (plan === null || (plan && !session)) {
    return (
      <View style={styles.empty}>
        <Text variant="bodyLarge">Aucune séance à démarrer.</Text>
        <Button contentStyle={styles.button} onPress={onDone}>
          Retour
        </Button>
      </View>
    );
  }
  if (!draft || !plan || !session) return <Text style={styles.loading}>Chargement…</Text>;

  const update = (i: number, j: number, patch: Partial<Row>) => setRows((all) => all.map((exercise, a) => (a === i ? exercise.map((row, b) => (b === j ? { ...row, ...patch } : row)) : exercise)));
  const doneRows = rows.flatMap((exercise) => exercise.filter((row) => row.done));
  const invalid = doneRows.some((row) => !rowIsValid(row));

  const finish = async () => {
    const done: LoggedSet[] = draft.flatMap((d, i) =>
      rows[i].flatMap((row, j) => (row.done ? [{ exerciseId: d.exercise.exerciseId, setNo: j + 1, reps: parseNumber(row.reps), kg: parseNumber(row.kg) }] : [])),
    );
    const { summary: earned, save } = await training.finishWorkout({ plan, session, done, startedAt });
    run(save);
    setSummary(earned);
  };

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        {draft.map(({ exercise, last, sets }, i) => (
          <Surface key={exercise.exerciseId} mode="flat" elevation={1} style={styles.card}>
            <Text variant="titleMedium">{exercise.name}</Text>
            <Text variant="bodyMedium" style={{ color: colors.onSurfaceVariant }}>
              {last.length > 0 ? `Dernière fois : ${setsText(last)}` : 'Première fois'}
            </Text>
            {sets[0].kg > 0 && <Text variant="bodyMedium">{`À viser : ${kgText(sets[0].kg)}`}</Text>}
            {rows[i].map((row, j) => (
              <View key={j} style={styles.set}>
                <Text variant="labelLarge" style={styles.setNo}>
                  {j + 1}
                </Text>
                <TextInput
                  style={styles.field}
                  label="Charge (kg)"
                  accessibilityLabel={`${exercise.name}, série ${j + 1}, charge (kg)`}
                  value={row.kg}
                  onChangeText={(kg) => update(i, j, { kg })}
                  keyboardType="decimal-pad"
                />
                <TextInput
                  style={styles.field}
                  label="Répétitions"
                  accessibilityLabel={`${exercise.name}, série ${j + 1}, répétitions`}
                  value={row.reps}
                  onChangeText={(reps) => update(i, j, { reps })}
                  keyboardType="number-pad"
                />
                <IconButton
                  icon={row.done ? 'check-circle' : 'circle-outline'}
                  iconColor={row.done ? colors.primary : undefined}
                  style={styles.iconButton}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: row.done }}
                  accessibilityLabel={`${exercise.name}, série ${j + 1} faite`}
                  onPress={() => {
                    update(i, j, { done: !row.done });
                    if (!row.done) setRestSince(Date.now());
                  }}
                />
              </View>
            ))}
          </Surface>
        ))}
      </ScrollView>
      <Surface mode="flat" elevation={1} style={styles.bar}>
        <RestTimer since={restSince} onSkip={() => setRestSince(null)} />
        {invalid && (
          <Text variant="bodyMedium" accessibilityLiveRegion="polite" style={{ color: colors.error }}>
            La charge et les répétitions sont comprises entre 0 et 1 000.
          </Text>
        )}
        <Button mode="contained" contentStyle={styles.button} disabled={doneRows.length === 0 || invalid} onPress={() => void finish()}>
          Terminer
        </Button>
      </Surface>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: 16, gap: 16 },
  card: { padding: 16, gap: 8, borderRadius: 12 },
  set: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  setNo: { width: 20, textAlign: 'center' },
  field: { flex: 1 },
  // Paper's icon button is 40 dp, and its container clips the extra hit area: 48 dp make the touch target.
  iconButton: { width: 48, height: 48, borderRadius: 24 },
  bar: { padding: 16, gap: 8 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 },
  loading: { padding: 16 },
  button: { minHeight: 48 },
});
