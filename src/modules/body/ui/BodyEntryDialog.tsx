import { useState } from 'react';
import { StyleSheet } from 'react-native';
import { Button, Dialog, HelperText, Portal, TextInput } from 'react-native-paper';
import { validateMeasure, type Measure } from '../domain/body';

type Props = { initial: Measure; onCancel: () => void; onSave: (measure: Measure) => void };

const parse = (text: string) => (text.trim() === '' ? undefined : Number(text.replace(',', '.')));
const asText = (n: number | undefined) => (n === undefined ? '' : String(n).replace('.', ','));

/** The weight and the waist of the day, one tap away: either or both. The host mounts it while it is open. */
export function BodyEntryDialog({ initial, onCancel, onSave }: Props) {
  const [weight, setWeight] = useState(asText(initial.weightKg));
  const [waist, setWaist] = useState(asText(initial.waistCm));
  const [touched, setTouched] = useState(false);
  const measure: Measure = { weightKg: parse(weight), waistCm: parse(waist) };
  const given: Measure = Object.fromEntries(Object.entries(measure).filter(([, v]) => v !== undefined));
  const problem = validateMeasure(given);

  return (
    <Portal>
      <Dialog visible onDismiss={onCancel}>
        <Dialog.Title>Ma mesure du jour</Dialog.Title>
        <Dialog.Content style={styles.body}>
          <TextInput
            label="Poids (kg)"
            accessibilityLabel="Poids (kg)"
            value={weight}
            onChangeText={(text) => {
              setTouched(true);
              setWeight(text);
            }}
            keyboardType="decimal-pad"
            autoFocus
          />
          <TextInput
            label="Tour de taille (cm)"
            accessibilityLabel="Tour de taille (cm)"
            value={waist}
            onChangeText={(text) => {
              setTouched(true);
              setWaist(text);
            }}
            keyboardType="decimal-pad"
          />
          {touched && problem && (
            <HelperText type="error" accessibilityLiveRegion="polite">
              {problem}
            </HelperText>
          )}
        </Dialog.Content>
        <Dialog.Actions>
          <Button contentStyle={styles.button} onPress={onCancel}>
            Annuler
          </Button>
          <Button contentStyle={styles.button} disabled={problem !== null} onPress={() => onSave(given)}>
            Enregistrer
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}

const styles = StyleSheet.create({ body: { gap: 12 }, button: { minHeight: 48 } });
