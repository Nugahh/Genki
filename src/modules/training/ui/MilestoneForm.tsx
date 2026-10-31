import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Chip, Dialog, HelperText, Portal, SegmentedButtons, TextInput } from 'react-native-paper';
import { exerciseMetric, validateMilestone, type NewMilestone } from '../domain/milestone';
import { parseNumber } from './format';

type Kind = 'reps' | 'kg';
type Props = { exercises: { exerciseId: string; name: string }[]; onCancel: () => void; onAdd: (milestone: NewMilestone) => void };

const KINDS = [
  { value: 'reps', label: 'Répétitions', labelStyle: { paddingVertical: 4 }, showSelectedCheck: true },
  { value: 'kg', label: 'Charge (kg)', labelStyle: { paddingVertical: 4 }, showSelectedCheck: true },
];
// A chip is 32 dp tall: 8 dp more above and below make the 48 dp target.
const HIT_SLOP = { top: 8, bottom: 8 };

/** A milestone on an exercise of the programme: its best set in reps, or its heaviest load, up to a target. The host mounts it while it is open. */
export function MilestoneForm({ exercises, onCancel, onAdd }: Props) {
  const [exerciseId, setExerciseId] = useState<string | null>(null);
  const [kind, setKind] = useState<Kind>('reps');
  const [text, setText] = useState('');
  const target = parseNumber(text);
  const exercise = exercises.find((e) => e.exerciseId === exerciseId);
  const milestone: NewMilestone | null = exercise
    ? { metric: exerciseMetric(exercise.exerciseId, kind), target, direction: 'up', label: `${exercise.name} : ${target.toLocaleString('fr-FR')} ${kind === 'reps' ? 'répétitions' : 'kg'}` }
    : null;
  const problem = milestone ? validateMilestone(milestone) : null;

  return (
    <Portal>
      <Dialog visible onDismiss={onCancel}>
        <Dialog.Title>Nouveau palier</Dialog.Title>
        <Dialog.ScrollArea>
          <View style={styles.body}>
            <View style={styles.chips}>
              {exercises.map((e) => (
                <Chip key={e.exerciseId} hitSlop={HIT_SLOP} selected={e.exerciseId === exerciseId} onPress={() => setExerciseId(e.exerciseId)}>
                  {e.name}
                </Chip>
              ))}
            </View>
            <SegmentedButtons value={kind} onValueChange={(value) => setKind(value as Kind)} buttons={KINDS} />
            <TextInput label="Cible" accessibilityLabel="Cible" value={text} onChangeText={setText} keyboardType="decimal-pad" />
            {text.trim() !== '' && problem && (
              <HelperText type="error" accessibilityLiveRegion="polite">
                {problem}
              </HelperText>
            )}
          </View>
        </Dialog.ScrollArea>
        <Dialog.Actions>
          <Button contentStyle={styles.button} onPress={onCancel}>
            Annuler
          </Button>
          <Button contentStyle={styles.button} disabled={!milestone || problem !== null} onPress={() => milestone && onAdd(milestone)}>
            Ajouter
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}

const styles = StyleSheet.create({
  body: { gap: 12, paddingVertical: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  button: { minHeight: 48 },
});
