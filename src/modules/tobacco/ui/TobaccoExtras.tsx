import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, IconButton, Surface, Text, useTheme } from 'react-native-paper';
import type { Clock } from '@/shared/clock';
import type { QuitProfile, TobaccoUseCases } from '../application/tobaccoUseCases';
import type { Craving } from '../domain/tobacco';
import { useTobaccoSummary } from './useTobaccoSummary';

type Props = {
  tobacco: TobaccoUseCases;
  profile: QuitProfile;
  clock: Clock;
  timezone: string;
  /** The day of the period shown, and whether the period is a day: the journal of the cravings is the day's. */
  day: string;
  isDay: boolean;
  /** Runs a write; a rejected one is offered again with « Réessayer » (spec §8). */
  run: (write: () => Promise<void>) => void;
  onOpenSettings: () => void;
};

const euros = (n: number) => `${n.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} €`;

/** In the Tabac section of Suivi: the days, the record and the savings; the two buttons that note a craving; the journal of a day. */
export function TobaccoExtras({ tobacco, profile, clock, timezone, day, isDay, run, onOpenSettings }: Props) {
  const { colors } = useTheme();
  const summary = useTobaccoSummary(tobacco, profile, clock, timezone);
  // The craving just noted, offered back: a one-tap note is easy to mis-tap.
  const [last, setLast] = useState<Craving | null>(null);
  const [cravings, setCravings] = useState<{ day: string; list: Craving[] } | null>(null);
  // Listener errors show on the SyncIcon, which watches the same user's data.
  useEffect(() => tobacco.observeDay(day, (list) => setCravings({ day, list }), () => {}), [tobacco, day]);

  const note = (resisted: boolean) =>
    run(() => {
      const { craving, saved } = tobacco.logCraving(resisted);
      setLast(craving);
      return saved;
    });
  const time = (c: Craving) => c.createdAt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: timezone });

  return (
    <>
      {!profile.quitDate && (
        <Surface mode="flat" elevation={1} style={styles.card}>
          <Text variant="bodyLarge">Renseigne ta date d’arrêt pour compter les jours sans tabac.</Text>
          <Button mode="contained-tonal" contentStyle={styles.button} onPress={onOpenSettings}>
            Choisir ma date d’arrêt
          </Button>
        </Surface>
      )}
      {profile.quitDate && summary && (
        <Surface mode="flat" elevation={1} style={styles.card} testID="tobacco-summary">
          <Row label="Jours sans fumer" value={String(summary.current)} />
          <Row label="Record" value={String(summary.record)} />
          {summary.savedEuros !== undefined && <Row label="Économisé" value={euros(summary.savedEuros)} />}
        </Surface>
      )}

      <View style={styles.actions}>
        <Button mode="contained-tonal" icon="shield-check" style={styles.grow} contentStyle={styles.button} onPress={() => note(true)}>
          Envie résistée
        </Button>
        <Button mode="outlined" icon="smoking" style={styles.grow} contentStyle={styles.button} onPress={() => note(false)}>
          J’ai fumé
        </Button>
      </View>
      {last && (
        <Surface mode="flat" elevation={1} style={styles.undo}>
          <Text variant="bodyLarge" accessibilityLiveRegion="polite" style={styles.grow}>
            {last.resisted ? 'Envie résistée notée.' : 'Cigarette notée.'}
          </Text>
          <Button
            contentStyle={styles.button}
            onPress={() => {
              run(() => tobacco.removeCraving(last));
              setLast(null);
            }}
          >
            Annuler
          </Button>
        </Surface>
      )}

      {isDay && cravings?.day === day && (
        <Surface mode="flat" elevation={1} style={styles.card}>
          <Text variant="titleMedium" accessibilityRole="header">
            Envies du jour
          </Text>
          {cravings.list.length === 0 && (
            <Text variant="bodyLarge" style={{ color: colors.onSurfaceVariant }}>
              Aucune envie notée ce jour-là.
            </Text>
          )}
          {cravings.list.map((c) => (
            <View key={c.id} style={styles.row}>
              <Text variant="bodyLarge" style={styles.grow}>{`${time(c)} · ${c.resisted ? 'envie résistée' : 'cigarette fumée'}`}</Text>
              <IconButton icon="delete-outline" style={styles.iconButton} accessibilityLabel={`Supprimer l’envie de ${time(c)}`} onPress={() => run(() => tobacco.removeCraving(c))} />
            </View>
          ))}
        </Surface>
      )}
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.row}>
      <Text variant="bodyLarge" style={[styles.grow, { color: colors.onSurfaceVariant }]}>
        {label}
      </Text>
      <Text variant="titleMedium">{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: 16, gap: 8, borderRadius: 16 },
  actions: { flexDirection: 'row', gap: 8 },
  grow: { flexGrow: 1, flexShrink: 1 },
  undo: { flexDirection: 'row', alignItems: 'center', paddingLeft: 16, paddingRight: 8, borderRadius: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  // Paper's icon button is 40 dp, and its container clips the extra hit area: 48 dp make the touch target.
  iconButton: { width: 48, height: 48, borderRadius: 24 },
  button: { minHeight: 48 },
});
