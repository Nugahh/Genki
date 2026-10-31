import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { IconButton, List, Modal, Portal, Text, useTheme } from 'react-native-paper';
import type { WaterContainer } from '@/modules/settings';
import type { WaterEntry } from '../application/ports';
import type { Hydration } from '../application/waterUseCases';
import { WaterButtons } from './WaterButtons';

type Props = {
  visible: boolean;
  onDismiss: () => void;
  day: string;
  timezone: string;
  containers: WaterContainer[];
  hydration: Hydration;
  run: (write: () => Promise<void>) => void;
};

/** Quick-add sheet: the add buttons and the day's glasses, no stats page (spec §6). */
export function WaterSheet({ visible, onDismiss, day, timezone, containers, hydration, run }: Props) {
  const [entries, setEntries] = useState<WaterEntry[]>([]);
  const { colors } = useTheme();
  // Listener errors show on the SyncIcon, which watches the same user's data.
  useEffect(() => hydration.observeDay(day, setEntries, () => {}), [hydration, day]);

  const time = (date: Date) => date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: timezone });

  return (
    <Portal>
      <Modal visible={visible} onDismiss={onDismiss} overlayAccessibilityLabel="Fermer" contentContainerStyle={[styles.sheet, { backgroundColor: colors.elevation.level3 }]}>
        <Text variant="titleLarge">Eau</Text>
        <WaterButtons containers={containers} onAdd={(ml) => run(() => hydration.addWater(ml))} />
        <ScrollView style={styles.list}>
          {entries.length === 0 && <Text>Aucun verre aujourd’hui.</Text>}
          {entries.map((entry) => (
            <List.Item
              key={entry.id}
              title={`${entry.ml} ml`}
              description={time(entry.createdAt)}
              right={() => (
                <IconButton
                  icon="delete-outline"
                  style={styles.iconButton}
                  accessibilityLabel={`Supprimer ${entry.ml} ml de ${time(entry.createdAt)}`}
                  onPress={() => run(() => hydration.removeWater(entry))}
                />
              )}
            />
          ))}
        </ScrollView>
      </Modal>
    </Portal>
  );
}

const styles = StyleSheet.create({
  sheet: { margin: 16, padding: 16, gap: 12, borderRadius: 16 },
  list: { maxHeight: 360 },
  // Paper's icon button is 40 dp, and its container clips the extra hit area: 48 dp make the touch target.
  iconButton: { width: 48, height: 48, borderRadius: 24 },
});
