import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Text } from 'react-native-paper';

const REST_S = 90;
const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

type Props = { /** When the rest began (ms), or null when none is running. */ since: number | null; onSkip: () => void };

/** The rest between two sets: a countdown from 1:30 that hides itself at zero. It leans on the wall clock, not on counting ticks. */
export function RestTimer({ since, onSkip }: Props) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (since === null) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [since]);

  if (since === null) return null;
  const left = Math.ceil(REST_S - Math.max(0, now - since) / 1000);
  if (left <= 0) return null;
  return (
    <View style={styles.row}>
      <Text variant="titleMedium" style={styles.time}>{`Repos ${clock(left)}`}</Text>
      <Button contentStyle={styles.button} onPress={onSkip}>
        Passer
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  // Tabular figures: the digits do not shift as it counts down.
  time: { fontVariant: ['tabular-nums'] },
  button: { minHeight: 48 },
});
