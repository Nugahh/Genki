import { useState } from 'react';
import { StyleSheet } from 'react-native';
import { Button, Dialog, Portal, TextInput } from 'react-native-paper';
import { isValidGrams, type FoodEntry } from '../domain/food';
import { ConfirmDelete } from './ConfirmDelete';
import { asText, parseNumber } from './format';

type Props = {
  /** The touched journal line; null while nothing is open. */
  entry: FoodEntry | null;
  onDismiss: () => void;
  onChangeGrams: (entry: FoodEntry, grams: number) => void;
  onRemove: (entry: FoodEntry) => void;
};

/** What a touched journal line offers: change its quantity or remove it (spec §6, instead of swiping). */
export function EntryActions({ entry, onDismiss, onChangeGrams, onRemove }: Props) {
  // null: the three choices; otherwise the quantity being typed.
  const [text, setText] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  if (entry === null) return null;

  const grams = parseNumber(text ?? '');
  const close = () => {
    setText(null);
    setConfirming(false);
    onDismiss();
  };

  if (confirming) {
    return (
      <ConfirmDelete
        title={`Supprimer ${entry.foodName} du journal ?`}
        onCancel={() => setConfirming(false)}
        onConfirm={() => {
          onRemove(entry);
          close();
        }}
      />
    );
  }

  return (
    <Portal>
      <Dialog visible onDismiss={close}>
        <Dialog.Title>{entry.foodName}</Dialog.Title>
        {text === null ? (
          <Dialog.Content style={styles.choices}>
            <Button mode="contained-tonal" contentStyle={styles.button} onPress={() => setText(asText(entry.grams))}>
              Modifier la quantité
            </Button>
            <Button mode="contained-tonal" contentStyle={styles.button} onPress={() => setConfirming(true)}>
              Supprimer
            </Button>
            <Button contentStyle={styles.button} onPress={close}>
              Annuler
            </Button>
          </Dialog.Content>
        ) : (
          <>
            <Dialog.Content>
              <TextInput label="Quantité (g)" accessibilityLabel="Quantité (g)" value={text} onChangeText={setText} keyboardType="decimal-pad" />
            </Dialog.Content>
            <Dialog.Actions>
              <Button contentStyle={styles.button} onPress={close}>
                Annuler
              </Button>
              <Button
                contentStyle={styles.button}
                disabled={!isValidGrams(grams)}
                onPress={() => {
                  onChangeGrams(entry, grams);
                  close();
                }}
              >
                Enregistrer
              </Button>
            </Dialog.Actions>
          </>
        )}
      </Dialog>
    </Portal>
  );
}

const styles = StyleSheet.create({
  choices: { gap: 8 },
  button: { minHeight: 48 },
});
