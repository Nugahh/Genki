import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { Button, Divider, List, Surface, Switch, Text, useTheme } from 'react-native-paper';
import type { HealthStatus } from '../application/ports';
import type { StepsUseCases } from '../application/stepsUseCases';
import { fitbitStatus, isFitbit, originName, type StepsSource } from '../domain/steps';
import { outcomeProblem, outcomeText } from './outcomeText';
import type { StepsSync } from './useStepsSync';

type Props = { steps: StepsUseCases; sync: StepsSync; timezone: string };

type Reading = { status: HealthStatus; granted: boolean; sources: StepsSource[] };

const time = (at: Date, timezone: string) => at.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: timezone });

/** Réglages › Pas (spec §7): the permission, the Fitbit among the sources, how to make it write, the sources, the phone that sends the steps. */
export function StepsSettingsScreen({ steps, sync, timezone }: Props) {
  const { colors } = useTheme();
  const [reading, setReading] = useState<Reading | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  // Bumped to read Health Connect again (after the permission was asked).
  const [reads, setReads] = useState(0);
  useEffect(() => {
    let stale = false;
    (async () => {
      try {
        const status = await steps.status();
        const granted = status === 'ready' && (await steps.hasPermission());
        const sources = granted ? await steps.sources() : [];
        if (stale) return;
        setReading({ status, granted, sources });
        setFailure(null);
      } catch (error) {
        if (!stale) setFailure(error instanceof Error ? error.message : 'La lecture de Health Connect a échoué.');
      }
    })();
    return () => {
      stale = true;
    };
  }, [steps, reads, sync.outcome]);

  const [authorizing, setAuthorizing] = useState(false);
  const authorize = async () => {
    setAuthorizing(true);
    try {
      await steps.requestPermission();
      setReads((n) => n + 1);
      void sync.sync();
    } catch (error) {
      setFailure(error instanceof Error ? error.message : 'La demande d’autorisation a échoué.');
    } finally {
      setAuthorizing(false);
    }
  };

  const fitbit = reading ? fitbitStatus(reading.sources, reading.granted) : undefined;
  const fitbitSource = reading?.sources.find((s) => isFitbit(s.origin));
  const problem = outcomeProblem(sync.outcome);
  const result = outcomeText(sync.outcome, timezone);
  const others = sync.devices.filter((d) => d.id !== steps.device.id);
  const otherWriter = others.find((d) => d.stepsWriter);
  // Only one phone writes the steps: this one can take the role unless it already has it alone. Two writers (two phones that started together) are put right here.
  const canTakeRole = !sync.isWriter || otherWriter !== undefined;
  const description = sync.isWriter
    ? otherWriter
      ? `${otherWriter.name} les envoie aussi : active l’interrupteur pour garder ce téléphone.`
      : 'Un seul téléphone écrit les pas du compte.'
    : otherWriter
      ? `Actuellement : ${otherWriter.name}`
      : 'Aucun téléphone ne les envoie.';

  return (
    <ScrollView contentContainerStyle={styles.content}>
      {failure && (
        <Text variant="bodyLarge" accessibilityLiveRegion="polite" style={{ color: colors.error }}>
          {failure}
        </Text>
      )}

      <Surface mode="flat" elevation={1} style={styles.card}>
        <Text variant="titleMedium" accessibilityRole="header">
          État
        </Text>
        {reading?.status === 'unavailable' && <Text variant="bodyLarge">Health Connect n’est pas disponible sur ce téléphone.</Text>}
        {reading?.status === 'update-needed' && <Text variant="bodyLarge">Health Connect doit être mis à jour pour lire les pas.</Text>}
        {reading?.status === 'ready' && (
          <>
            <List.Item
              title="Lecture des pas"
              description={reading.granted ? 'Accordée' : 'Pas encore accordée'}
              left={(props) => <List.Icon {...props} icon={reading.granted ? 'check-circle-outline' : 'alert-circle-outline'} />}
            />
            {!reading.granted && (
              <Button mode="contained" contentStyle={styles.button} disabled={authorizing} onPress={() => void authorize()}>
                Autoriser la lecture des pas
              </Button>
            )}
            <List.Item
              title="Fitbit"
              description={
                fitbit === 'detected'
                  ? `Détecté${fitbitSource?.lastDataAt ? `, dernière donnée à ${time(fitbitSource.lastDataAt, timezone)}` : ''}`
                  : fitbit === 'phone-counts'
                    ? 'Pas détecté : le téléphone compte les pas'
                    : 'Autorise d’abord la lecture des pas'
              }
              left={(props) => <List.Icon {...props} icon="watch" />}
            />
          </>
        )}
      </Surface>

      <Surface mode="flat" elevation={1} style={styles.card}>
        <Text variant="titleMedium" accessibilityRole="header">
          Faire écrire le Fitbit
        </Text>
        <Text variant="bodyMedium">
          {'1. Ouvre l’application Fitbit et connecte-la à Health Connect.\n2. Active l’écriture des pas dans ses réglages Health Connect : elle n’est pas cochée par défaut.\n3. Laisse le Bluetooth actif : le tracker envoie ses données toutes les 15 minutes environ.'}
        </Text>
      </Surface>

      {reading?.granted && (
        <Surface mode="flat" elevation={1} style={styles.card}>
          <Text variant="titleMedium" accessibilityRole="header">
            Sources d’aujourd’hui
          </Text>
          {reading.sources.length === 0 && <Text variant="bodyLarge">Aucune application n’a écrit de pas aujourd’hui.</Text>}
          {reading.sources.map((s) => (
            <List.Item key={s.origin} title={originName(s.origin)} description={s.lastDataAt ? `Dernière donnée à ${time(s.lastDataAt, timezone)}` : undefined} />
          ))}
        </Surface>
      )}

      <Button mode="outlined" icon="open-in-new" contentStyle={styles.button} onPress={() => steps.openHealthSettings()}>
        Ouvrir Health Connect
      </Button>
      <Text variant="bodySmall" style={{ color: colors.onSurfaceVariant }}>
        Dans Health Connect, « Ordre de priorité des applications » décide de celle qui compte quand le Fitbit et le téléphone écrivent tous deux des pas.
      </Text>

      <Divider />
      <List.Item
        title="Ce téléphone envoie les pas"
        description={description}
        onPress={canTakeRole ? sync.makeWriter : undefined}
        right={() => <Switch value={sync.isWriter} disabled={!canTakeRole} onValueChange={sync.makeWriter} accessibilityLabel="Ce téléphone envoie les pas" />}
      />

      <Button mode="contained-tonal" icon="sync" contentStyle={styles.button} onPress={() => void sync.sync()}>
        Synchroniser maintenant
      </Button>
      {/* When the service itself is absent or old, the state card above has already said it. */}
      {result && reading?.status === 'ready' && (
        <Text variant="bodyLarge" accessibilityLiveRegion="polite" style={{ color: problem ? colors.error : colors.onSurface }}>
          {result}
        </Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 12 },
  card: { padding: 16, gap: 8, borderRadius: 16 },
  button: { minHeight: 48 },
});
