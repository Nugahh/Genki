import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Chip, Dialog, HelperText, Portal, SegmentedButtons, TextInput } from 'react-native-paper';
import { exerciseMetric, validateMilestone, type Direction, type NewMilestone } from '../domain/milestone';
import { parseNumber } from './format';

type Kind = 'reps' | 'kg';
type BodyId = 'weightKg' | 'waistCm';
type Props = { exercises: { exerciseId: string; name: string }[]; onCancel: () => void; onAdd: (milestone: NewMilestone) => void };

const BODY: { id: BodyId; name: string; unit: string }[] = [
  { id: 'weightKg', name: 'Poids', unit: 'kg' },
  { id: 'waistCm', name: 'Tour de taille', unit: 'cm' },
];
const DIRECTIONS = [
  { value: 'down', label: 'Descendre à', labelStyle: { paddingVertical: 4 }, showSelectedCheck: true },
  { value: 'up', label: 'Atteindre', labelStyle: { paddingVertical: 4 }, showSelectedCheck: true },
];
const KINDS = [
  { value: 'reps', label: 'Répétitions', labelStyle: { paddingVertical: 4 }, showSelectedCheck: true },
  { value: 'kg', label: 'Charge (kg)', labelStyle: { paddingVertical: 4 }, showSelectedCheck: true },
];
// A chip is 32 dp tall: 8 dp more above and below make the 48 dp target.
const HIT_SLOP = { top: 8, bottom: 8 };

/** A milestone on an exercise of the programme (its best set in reps, or its heaviest load, up to a target) or on a measure of the body (down to, or up to, a target). The host mounts it while it is open. */
export function MilestoneForm({ exercises, onCancel, onAdd }: Props) {
  const [exerciseId, setExerciseId] = useState<string | null>(null);
  const [bodyId, setBodyId] = useState<BodyId | null>(null);
  const [direction, setDirection] = useState<Direction>('down');
  const [kind, setKind] = useState<Kind>('reps');
  const [text, setText] = useState('');
  const target = parseNumber(text);
  const exercise = exercises.find((e) => e.exerciseId === exerciseId);
  const body = BODY.find((b) => b.id === bodyId);
  const amount = target.toLocaleString('fr-FR');
  const milestone: NewMilestone | null = body
    ? { metric: body.id, target, direction, label: direction === 'down' ? `${body.name} sous ${amount} ${body.unit}` : `${body.name} : au moins ${amount} ${body.unit}` }
    : exercise
      ? { metric: exerciseMetric(exercise.exerciseId, kind), target, direction: 'up', label: `${exercise.name} : ${amount} ${kind === 'reps' ? 'répétitions' : 'kg'}` }
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
                <Chip
                  key={e.exerciseId}
                  hitSlop={HIT_SLOP}
                  selected={e.exerciseId === exerciseId}
                  onPress={() => {
                    setExerciseId(e.exerciseId);
                    setBodyId(null);
                  }}
                >
                  {e.name}
                </Chip>
              ))}
              {BODY.map((b) => (
                <Chip
                  key={b.id}
                  hitSlop={HIT_SLOP}
                  selected={b.id === bodyId}
                  onPress={() => {
                    setBodyId(b.id);
                    setExerciseId(null);
                  }}
                >
                  {b.name}
                </Chip>
              ))}
            </View>
            {body ? (
              <SegmentedButtons value={direction} onValueChange={(value) => setDirection(value as Direction)} buttons={DIRECTIONS} />
            ) : (
              <SegmentedButtons value={kind} onValueChange={(value) => setKind(value as Kind)} buttons={KINDS} />
            )}
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
