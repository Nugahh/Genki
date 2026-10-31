import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, Dialog, IconButton, List, Portal, Surface, Text, TextInput, useTheme } from 'react-native-paper';
import { ConfirmDialog } from '@/shared/ConfirmDialog';
import type { TrainingUseCases } from '../application/trainingUseCases';
import { renamed, replaceExercise, withAddedExercise, withoutExercise, type ExerciseAt, type Plan, type PlannedExercise } from '../domain/plan';
import { ExerciseForm } from './ExerciseForm';

type Props = {
  training: TrainingUseCases;
  run: (write: () => Promise<void>) => void;
  onOpenHistory: (exerciseId: string, name: string) => void;
};

type Editing = { at: ExerciseAt } | { add: { phase: number; session: number } };

const fr = (n: number) => n.toLocaleString('fr-FR', { maximumFractionDigits: 2 });
const detail = (e: PlannedExercise) => `${e.sets} × ${e.reps}${e.incrementKg > 0 ? ` · +${fr(e.incrementKg)} kg` : ''}`;

/** Changes the programme in progress: its name, and each exercise (name, sets, reps, increment), added to or removed from a session. */
// shortcut: phases and sessions cannot be added, removed or renamed here, only the exercises; add them when the template stops being enough.
export function PlanScreen({ training, run, onOpenHistory }: Props) {
  const { colors } = useTheme();
  const [plan, setPlan] = useState<Plan | null>(null);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [removing, setRemoving] = useState<ExerciseAt | null>(null);
  const [renaming, setRenaming] = useState(false);
  // Listener errors show on the SyncIcon, which watches the same user's data.
  useEffect(() => training.observePlans((plans) => setPlan(plans.find((p) => p.active) ?? null), () => {}), [training]);

  if (!plan) return null;
  const save = (next: Plan) => run(() => training.savePlan(next));
  const exerciseAt = (at: ExerciseAt) => plan.phases[at.phase].sessions[at.session].exercises[at.exercise];
  const editedExercise = editing && 'at' in editing ? exerciseAt(editing.at) : undefined;

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.title}>
        <Text variant="titleLarge" style={styles.name}>
          {plan.name}
        </Text>
        <IconButton icon="pencil" style={styles.iconButton} accessibilityLabel="Renommer le programme" onPress={() => setRenaming(true)} />
      </View>

      {plan.phases.map((phase, p) => (
        <Surface key={p} mode="flat" elevation={1} style={styles.card}>
          <Text variant="titleMedium" accessibilityRole="header">{`Phase ${p + 1} — ${phase.name} · ${phase.weeks} semaines`}</Text>
          {phase.sessions.map((session, s) => (
            <View key={s} style={styles.session}>
              <Text variant="labelLarge" style={{ color: colors.onSurfaceVariant }}>
                {session.name}
              </Text>
              {session.exercises.map((exercise, e) => (
                <List.Item
                  key={e}
                  testID={`exercise-${p}-${s}-${e}`}
                  title={exercise.name}
                  description={detail(exercise)}
                  right={(props) => <List.Icon {...props} icon="pencil-outline" />}
                  accessibilityLabel={`${exercise.name}, ${detail(exercise)}, ${phase.name}, ${session.name}`}
                  accessibilityHint="Modifier l’exercice"
                  onPress={() => setEditing({ at: { phase: p, session: s, exercise: e } })}
                />
              ))}
              <Button icon="plus" testID={`add-${p}-${s}`} accessibilityLabel={`Ajouter un exercice, ${phase.name}, ${session.name}`} contentStyle={styles.button} onPress={() => setEditing({ add: { phase: p, session: s } })}>
                Ajouter un exercice
              </Button>
            </View>
          ))}
        </Surface>
      ))}

      {editing && (
        <ExerciseForm
          initial={editedExercise}
          canRemove={'at' in editing && plan.phases[editing.at.phase].sessions[editing.at.session].exercises.length > 1}
          onCancel={() => setEditing(null)}
          onSave={(exercise) => {
            save('at' in editing ? replaceExercise(plan, editing.at, exercise) : withAddedExercise(plan, editing.add, exercise));
            setEditing(null);
          }}
          onRemove={() => {
            if ('at' in editing) setRemoving(editing.at);
            setEditing(null);
          }}
          onHistory={() => {
            if (editedExercise) onOpenHistory(editedExercise.exerciseId, editedExercise.name);
            setEditing(null);
          }}
        />
      )}
      {removing && (
        <ConfirmDialog
          title={`Supprimer l’exercice ${exerciseAt(removing).name} ?`}
          confirmLabel="Supprimer"
          onCancel={() => setRemoving(null)}
          onConfirm={() => {
            save(withoutExercise(plan, removing));
            setRemoving(null);
          }}
        />
      )}
      {renaming && (
        <NameDialog
          name={plan.name}
          onCancel={() => setRenaming(false)}
          onSave={(name) => {
            save(renamed(plan, name));
            setRenaming(false);
          }}
        />
      )}
    </ScrollView>
  );
}

function NameDialog({ name, onCancel, onSave }: { name: string; onCancel: () => void; onSave: (name: string) => void }) {
  const [text, setText] = useState(name);
  const valid = text.trim().length > 0 && text.length <= 100;
  return (
    <Portal>
      <Dialog visible onDismiss={onCancel}>
        <Dialog.Title>Nom du programme</Dialog.Title>
        <Dialog.Content>
          <TextInput label="Nom du programme" accessibilityLabel="Nom du programme" maxLength={100} value={text} onChangeText={setText} />
        </Dialog.Content>
        <Dialog.Actions>
          <Button contentStyle={styles.button} onPress={onCancel}>
            Annuler
          </Button>
          <Button contentStyle={styles.button} disabled={!valid} onPress={() => onSave(text.trim())}>
            Enregistrer
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 16 },
  title: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  name: { flexShrink: 1 },
  card: { padding: 16, gap: 8, borderRadius: 12 },
  session: { gap: 4, marginTop: 8 },
  // Paper's icon button is 40 dp, and its container clips the extra hit area: 48 dp make the touch target.
  iconButton: { width: 48, height: 48, borderRadius: 24 },
  button: { minHeight: 48 },
});
