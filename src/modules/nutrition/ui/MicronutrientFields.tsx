import { useState } from 'react';
import { Keyboard, ScrollView, StyleSheet, View } from 'react-native';
import { Button, Dialog, IconButton, List, Portal, Text, TextInput } from 'react-native-paper';
import { NUTRIENTS, type NutrientId } from '../domain/nutrients';

/** A micronutrient being typed: its value stays text until the form is checked. */
export type NutrientRow = { id: NutrientId; value: string };

type Props = {
  rows: NutrientRow[];
  onChange: (rows: NutrientRow[]) => void;
  /** What the values are for, in the title: « pour 100 g » or « pour une portion ». */
  basis: string;
};

/** The micronutrients of a food being created: the ones added so far, each in its unit, and the way to add another from the 26 of the Suivi. */
export function MicronutrientFields({ rows, onChange, basis }: Props) {
  const [choosing, setChoosing] = useState(false);
  const left = NUTRIENTS.filter((n) => !rows.some((row) => row.id === n.id));
  const choose = () => {
    // The dialog is taller than what the keyboard leaves of the screen.
    Keyboard.dismiss();
    setChoosing(true);
  };

  return (
    <View style={styles.box}>
      <Text variant="titleSmall" accessibilityRole="header">{`Micronutriments (${basis})`}</Text>
      {rows.map((row, i) => {
        const info = NUTRIENTS.find((n) => n.id === row.id)!;
        return (
          <View key={row.id} style={styles.row}>
            <TextInput
              style={styles.field}
              label={`${info.label} (${info.unit})`}
              accessibilityLabel={`${info.label} (${info.unit})`}
              value={row.value}
              onChangeText={(value) => onChange(rows.map((r, j) => (j === i ? { ...r, value } : r)))}
              keyboardType="decimal-pad"
            />
            <IconButton icon="delete-outline" style={styles.iconButton} accessibilityLabel={`Retirer ${info.label}`} onPress={() => onChange(rows.filter((_, j) => j !== i))} />
          </View>
        );
      })}
      {left.length > 0 && (
        <Button icon="plus" contentStyle={styles.button} onPress={choose}>
          Ajouter un micronutriment
        </Button>
      )}
      {choosing && (
        <Portal>
          <Dialog visible onDismiss={() => setChoosing(false)}>
            <Dialog.Title>Ajouter un micronutriment</Dialog.Title>
            <Dialog.ScrollArea style={styles.scroll}>
              <ScrollView>
                {left.map((n) => (
                  <List.Item
                    key={n.id}
                    title={n.label}
                    description={n.unit}
                    onPress={() => {
                      onChange([...rows, { id: n.id, value: '' }]);
                      setChoosing(false);
                    }}
                  />
                ))}
              </ScrollView>
            </Dialog.ScrollArea>
            <Dialog.Actions>
              <Button contentStyle={styles.button} onPress={() => setChoosing(false)}>
                Fermer
              </Button>
            </Dialog.Actions>
          </Dialog>
        </Portal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  field: { flex: 1 },
  // Paper's icon button is 40 dp, and its container clips the extra hit area: 48 dp make the touch target.
  iconButton: { width: 48, height: 48, borderRadius: 24 },
  button: { minHeight: 48 },
  scroll: { maxHeight: 360 },
});
