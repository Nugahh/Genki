import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Dialog, HelperText, Portal, TextInput } from 'react-native-paper';
import { exerciseIdOf, validateExercise, type PlannedExercise } from '../domain/plan';
import { asText, parseNumber } from './format';

type Props = {
  /** The exercise being changed; a new one when omitted. */
  initial?: PlannedExercise;
  /** Whether the session has another exercise: a session keeps at least one. */
  canRemove: boolean;
  onCancel: () => void;
  onSave: (exercise: PlannedExercise) => void;
  onRemove: () => void;
  onHistory: () => void;
};

/** An exercise of a session: its name (its id follows it), its sets and reps, and the load added when every set is reached. The host mounts it while it is open. */
export function ExerciseForm({ initial, canRemove, onCancel, onSave, onRemove, onHistory }: Props) {
  const [name, setName] = useState(initial?.name ?? '');
  const [sets, setSets] = useState(asText(initial?.sets ?? 3));
  const [reps, setReps] = useState(asText(initial?.reps ?? 10));
  const [increment, setIncrement] = useState(asText(initial?.incrementKg ?? 0));
  const [touched, setTouched] = useState(false);
  const change = (set: (text: string) => void) => (text: string) => {
    setTouched(true);
    set(text);
  };

  const exercise: PlannedExercise = { exerciseId: exerciseIdOf(name), name: name.trim(), sets: parseNumber(sets), reps: parseNumber(reps), incrementKg: parseNumber(increment) };
  const problem = validateExercise(exercise);

  return (
    <Portal>
      <Dialog visible onDismiss={onCancel}>
        <Dialog.Title>{initial ? 'Modifier l’exercice' : 'Nouvel exercice'}</Dialog.Title>
        <Dialog.ScrollArea>
          <View style={styles.body}>
            <TextInput label="Nom" accessibilityLabel="Nom" value={name} onChangeText={change(setName)} />
            <TextInput label="Séries" accessibilityLabel="Séries" value={sets} onChangeText={change(setSets)} keyboardType="number-pad" />
            <TextInput label="Répétitions" accessibilityLabel="Répétitions" value={reps} onChangeText={change(setReps)} keyboardType="number-pad" />
            <TextInput label="Incrément de charge (kg)" accessibilityLabel="Incrément de charge (kg)" value={increment} onChangeText={change(setIncrement)} keyboardType="decimal-pad" />
            {touched && problem && (
              <HelperText type="error" accessibilityLiveRegion="polite">
                {problem}
              </HelperText>
            )}
            {initial && (
              <>
                <Button icon="chart-line" contentStyle={styles.button} onPress={onHistory}>
                  Voir l’historique
                </Button>
                <Button icon="delete-outline" contentStyle={styles.button} disabled={!canRemove} onPress={onRemove}>
                  Supprimer l’exercice
                </Button>
                {!canRemove && <HelperText type="info">Une séance garde au moins un exercice.</HelperText>}
              </>
            )}
          </View>
        </Dialog.ScrollArea>
        <Dialog.Actions>
          <Button contentStyle={styles.button} onPress={onCancel}>
            Annuler
          </Button>
          <Button contentStyle={styles.button} disabled={problem !== null} onPress={() => onSave(exercise)}>
            {initial ? 'Enregistrer' : 'Ajouter'}
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}

const styles = StyleSheet.create({
  body: { gap: 12, paddingVertical: 12 },
  button: { minHeight: 48 },
});
