import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Icon, IconButton, Surface, Text, TouchableRipple, useTheme } from 'react-native-paper';
import type { Clock } from '@/shared/clock';
import type { BodyUseCases } from '../application/bodyUseCases';
import { BodyEntryDialog } from './BodyEntryDialog';
import { useBodySummary } from './useBodySummary';

type Props = {
  body: BodyUseCases;
  clock: Clock;
  timezone: string;
  /** Runs a write; a rejected one is offered again with « Réessayer » (spec §8). */
  run: (write: () => Promise<void>) => void;
  /** Opens the Suivi of the weight. */
  onOpen: () => void;
};

const fr = (n: number) => n.toLocaleString('fr-FR', { maximumFractionDigits: 1 });

/** The weight of the day and its mean over seven days (spec §6); the plus enters a measure in one tap. */
export function BodyCard({ body, clock, timezone, run, onOpen }: Props) {
  const { colors } = useTheme();
  const summary = useBodySummary(body, clock, timezone);
  const [entering, setEntering] = useState(false);
  if (!summary) return null;

  const { weightKg, waistCm } = summary.today;
  const value = weightKg === undefined ? '—' : `${fr(weightKg)} kg`;
  const caption = [
    summary.weightAverage === undefined ? 'Pas encore de pesée' : `Moyenne sur 7 jours : ${fr(summary.weightAverage)} kg`,
    waistCm === undefined ? undefined : `Tour de taille : ${fr(waistCm)} cm`,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <Surface mode="flat" elevation={1} style={styles.card}>
      <TouchableRipple onPress={onOpen} accessibilityRole="button" accessibilityLabel={`Poids, ${weightKg === undefined ? 'pas de pesée aujourd’hui' : value}, ${caption}`} accessibilityHint="Ouvre le suivi du poids" style={styles.touch}>
        <View style={styles.row}>
          <View style={[styles.badge, { backgroundColor: colors.secondaryContainer }]}>
            <Icon source="scale-bathroom" size={24} color={colors.onSecondaryContainer} />
          </View>
          <View style={styles.text}>
            <Text variant="bodyMedium" style={{ color: colors.onSurfaceVariant }}>
              Poids
            </Text>
            <Text variant="headlineSmall">{value}</Text>
            <Text variant="bodyMedium" style={{ color: colors.onSurfaceVariant }}>
              {caption}
            </Text>
          </View>
        </View>
      </TouchableRipple>
      <IconButton icon="plus" mode="contained-tonal" style={styles.add} accessibilityLabel="Saisir une mesure" onPress={() => setEntering(true)} />
      {entering && (
        <BodyEntryDialog
          initial={summary.today}
          onCancel={() => setEntering(false)}
          onSave={(measure) => {
            run(async () => void (await body.save(measure)));
            setEntering(false);
          }}
        />
      )}
    </Surface>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 16, flexDirection: 'row', alignItems: 'center' },
  touch: { flex: 1, padding: 16, minHeight: 48, borderRadius: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  badge: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, gap: 2 },
  // Paper's icon button is 40 dp, and its container clips the extra hit area: 48 dp make the touch target.
  add: { width: 48, height: 48, borderRadius: 24, marginLeft: 8, marginRight: 12 },
});
