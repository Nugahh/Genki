import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, HelperText, IconButton, TextInput } from 'react-native-paper';
import type { ProfilePatch } from '../application/ports';
import { validateProfile, type Profile } from '../domain/profile';
import { asText, parseNumber } from './format';

type Props = { profile: Profile; onSave: (patch: ProfilePatch) => void };
type Row = { label: string; ml: string };

const MAX = 6;

/** The containers of the quick-add buttons on Today: a name and an amount each, one to six. */
export function WaterContainersScreen({ profile, onSave }: Props) {
  const [rows, setRows] = useState<Row[]>(profile.waterContainers.map((c) => ({ label: c.label, ml: asText(c.ml) })));
  const change = (i: number, patch: Partial<Row>) => setRows((all) => all.map((row, j) => (j === i ? { ...row, ...patch } : row)));

  const waterContainers = rows.map((r) => ({ label: r.label.trim(), ml: parseNumber(r.ml) }));
  const problem = validateProfile({ ...profile, waterContainers });

  return (
    <ScrollView contentContainerStyle={styles.content}>
      {rows.map((row, i) => (
        <View key={i} style={styles.row}>
          <TextInput style={styles.name} label="Nom" accessibilityLabel={`Nom, contenant ${i + 1}`} value={row.label} onChangeText={(label) => change(i, { label })} maxLength={30} />
          <TextInput style={styles.amount} label="Contenance (ml)" accessibilityLabel={`Contenance (ml), contenant ${i + 1}`} value={row.ml} onChangeText={(ml) => change(i, { ml })} keyboardType="number-pad" />
          <IconButton
            icon="delete-outline"
            style={styles.iconButton}
            accessibilityLabel={`Supprimer le contenant ${row.label || i + 1}`}
            disabled={rows.length === 1}
            onPress={() => setRows((all) => all.filter((_, j) => j !== i))}
          />
        </View>
      ))}
      <Button icon="plus" contentStyle={styles.button} disabled={rows.length >= MAX} onPress={() => setRows((all) => [...all, { label: '', ml: '250' }])}>
        Ajouter un contenant
      </Button>
      {problem && (
        <HelperText type="error" accessibilityLiveRegion="polite">
          {problem}
        </HelperText>
      )}
      <Button mode="contained" contentStyle={styles.button} disabled={problem !== null} onPress={() => onSave({ waterContainers })}>
        Enregistrer
      </Button>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { flex: 2 },
  amount: { flex: 1 },
  // Paper's icon button is 40 dp, and its container clips the extra hit area: 48 dp make the touch target.
  iconButton: { width: 48, height: 48, borderRadius: 24 },
  button: { minHeight: 48 },
});
