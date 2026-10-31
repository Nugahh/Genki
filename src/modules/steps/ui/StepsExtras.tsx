import { StyleSheet } from 'react-native';
import { Button, Surface, Text, useTheme } from 'react-native-paper';
import type { SyncOutcome } from '../application/stepsUseCases';
import { outcomeProblem, outcomeText } from './outcomeText';

type Props = {
  outcome: SyncOutcome | null;
  timezone: string;
  onSync: () => void;
  onOpenSettings: () => void;
};

/** In the Activité section of Suivi: the sync button with what it did, and the way to Réglages › Pas. */
export function StepsExtras({ outcome, timezone, onSync, onOpenSettings }: Props) {
  const { colors } = useTheme();
  const text = outcomeText(outcome, timezone);
  return (
    <>
      {text && (
        <Surface mode="flat" elevation={1} style={styles.card}>
          <Text variant="bodyLarge" accessibilityLiveRegion="polite" style={{ color: outcomeProblem(outcome) ? colors.error : colors.onSurface }}>
            {text}
          </Text>
        </Surface>
      )}
      <Button mode="contained-tonal" icon="sync" contentStyle={styles.button} onPress={onSync}>
        Synchroniser
      </Button>
      <Button mode="outlined" icon="cog-outline" contentStyle={styles.button} onPress={onOpenSettings}>
        Réglages des pas
      </Button>
    </>
  );
}

const styles = StyleSheet.create({ card: { padding: 16, borderRadius: 16 }, button: { minHeight: 48 } });
