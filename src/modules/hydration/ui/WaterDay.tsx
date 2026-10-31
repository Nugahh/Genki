import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { IconButton, Surface, Text, useTheme } from 'react-native-paper';
import type { WaterEntry } from '../application/ports';
import type { Hydration } from '../application/waterUseCases';

type Props = {
  hydration: Hydration;
  day: string;
  timezone: string;
  /** Runs a write; a rejected one is offered again with « Réessayer » (spec §8). */
  run: (write: () => Promise<void>) => void;
};

/** The glasses of a day, newest first, each with its time and a way to take it back. */
export function WaterDay({ hydration, day, timezone, run }: Props) {
  const { colors } = useTheme();
  // The list keeps its day, so that the glasses of another day are never shown while this one loads.
  const [loaded, setLoaded] = useState<{ day: string; glasses: WaterEntry[] } | null>(null);
  // Listener errors show on the SyncIcon, which watches the same user's data.
  useEffect(() => hydration.observeDay(day, (glasses) => setLoaded({ day, glasses }), () => {}), [hydration, day]);
  if (loaded?.day !== day) return null;
  const { glasses } = loaded;

  const time = (entry: WaterEntry) => entry.createdAt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: timezone });
  return (
    <Surface mode="flat" elevation={1} style={styles.card}>
      <Text variant="titleMedium" accessibilityRole="header">
        Verres du jour
      </Text>
      {glasses.length === 0 && (
        <Text variant="bodyLarge" style={{ color: colors.onSurfaceVariant }}>
          Aucun verre ce jour-là.
        </Text>
      )}
      {glasses.map((glass) => (
        <View key={glass.id} style={styles.row}>
          <Text variant="bodyLarge" style={styles.label}>{`${time(glass)} · ${glass.ml} ml`}</Text>
          <IconButton icon="delete-outline" style={styles.iconButton} accessibilityLabel={`Supprimer ${glass.ml} ml de ${time(glass)}`} onPress={() => run(() => hydration.removeWater(glass))} />
        </View>
      ))}
    </Surface>
  );
}

const styles = StyleSheet.create({
  card: { padding: 16, gap: 4, borderRadius: 16 },
  row: { flexDirection: 'row', alignItems: 'center' },
  label: { flex: 1 },
  // Paper's icon button is 40 dp, and its container clips the extra hit area: 48 dp make the touch target.
  iconButton: { width: 48, height: 48, borderRadius: 24 },
});
