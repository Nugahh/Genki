import { useState } from 'react';
import { StyleSheet } from 'react-native';
import { Button, Dialog, HelperText, Portal, TextInput } from 'react-native-paper';

// The rules take a glass above 0 and up to 5 000 ml (firestore.rules).
const MAX_ML = 5000;
const parse = (text: string) => (text.trim() === '' ? NaN : Number(text.replace(',', '.')));
const isValid = (ml: number) => ml > 0 && ml <= MAX_ML;

type Props = { onDismiss: () => void; onAdd: (ml: number) => void };

/** A small box to type any quantity of water, for what the quick buttons do not cover. The host mounts it while it is open. */
export function WaterAmountDialog({ onDismiss, onAdd }: Props) {
  const [text, setText] = useState('');
  const ml = parse(text);
  return (
    <Portal>
      <Dialog visible onDismiss={onDismiss}>
        <Dialog.Title>Quantité d’eau</Dialog.Title>
        <Dialog.Content>
          <TextInput
            label="Quantité (ml)"
            accessibilityLabel="Quantité (ml)"
            value={text}
            onChangeText={setText}
            keyboardType="decimal-pad"
            autoFocus
          />
          {text.trim() !== '' && !isValid(ml) && (
            <HelperText type="error" accessibilityLiveRegion="polite">
              La quantité doit être comprise entre 1 et 5 000 ml.
            </HelperText>
          )}
        </Dialog.Content>
        <Dialog.Actions>
          <Button contentStyle={styles.button} onPress={onDismiss}>
            Annuler
          </Button>
          <Button
            contentStyle={styles.button}
            disabled={!isValid(ml)}
            onPress={() => {
              onAdd(Math.round(ml));
              onDismiss();
            }}
          >
            Ajouter
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}

const styles = StyleSheet.create({ button: { minHeight: 48 } });
