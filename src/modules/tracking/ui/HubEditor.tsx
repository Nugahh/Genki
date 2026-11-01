import { StyleSheet, View } from 'react-native';
import { Button, Dialog, IconButton, Portal, Text } from 'react-native-paper';
import { ALL_METRICS, findMetric } from '../application/registry';

type Props = {
  /** The statistics on the hub, in order. */
  shown: string[];
  onChange: (shown: string[]) => void;
  onClose: () => void;
};

const swap = (list: string[], i: number, j: number) => list.map((id, k) => (k === i ? list[j] : k === j ? list[i] : id));

/** Which statistics the hub shows and in which order: move, hide, or add one back (no drag and drop). The host mounts it while it is open. */
export function HubEditor({ shown, onChange, onClose }: Props) {
  // The nutrients have their own screen: a hub card would read a year of meals in the year view, and could not say a total is partial.
  const hidden = ALL_METRICS.filter((m) => m.section !== 'micro' && !shown.includes(m.id));
  return (
    <Portal>
      <Dialog visible onDismiss={onClose}>
        <Dialog.Title>Modifier les cartes</Dialog.Title>
        <Dialog.ScrollArea>
          <View style={styles.body}>
            {shown.map((id, i) => {
              const label = findMetric(id)?.label ?? id;
              return (
                <View key={id} style={styles.row}>
                  <Text variant="bodyLarge" style={styles.label}>
                    {label}
                  </Text>
                  <IconButton icon="arrow-up" style={styles.iconButton} accessibilityLabel={`Monter ${label}`} disabled={i === 0} onPress={() => onChange(swap(shown, i, i - 1))} />
                  <IconButton icon="arrow-down" style={styles.iconButton} accessibilityLabel={`Descendre ${label}`} disabled={i === shown.length - 1} onPress={() => onChange(swap(shown, i, i + 1))} />
                  <IconButton icon="eye-off-outline" style={styles.iconButton} accessibilityLabel={`Masquer ${label}`} onPress={() => onChange(shown.filter((other) => other !== id))} />
                </View>
              );
            })}
            {hidden.length > 0 && (
              <>
                <Text variant="titleSmall" accessibilityRole="header" style={styles.section}>
                  Ajouter une statistique
                </Text>
                {hidden.map((m) => (
                  <View key={m.id} style={styles.row}>
                    <Text variant="bodyLarge" style={styles.label}>
                      {m.label}
                    </Text>
                    <IconButton icon="plus" style={styles.iconButton} accessibilityLabel={`Ajouter ${m.label}`} onPress={() => onChange([...shown, m.id])} />
                  </View>
                ))}
              </>
            )}
          </View>
        </Dialog.ScrollArea>
        <Dialog.Actions>
          <Button contentStyle={styles.button} onPress={onClose}>
            Terminé
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}

const styles = StyleSheet.create({
  body: { paddingVertical: 8 },
  row: { flexDirection: 'row', alignItems: 'center' },
  label: { flex: 1 },
  section: { marginTop: 16, marginBottom: 4 },
  // Paper's icon button is 40 dp, and its container clips the extra hit area: 48 dp make the touch target.
  iconButton: { width: 48, height: 48, borderRadius: 24 },
  button: { minHeight: 48 },
});
