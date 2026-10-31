import { useState } from 'react';
import { StyleSheet } from 'react-native';
import { Button } from 'react-native-paper';
import type { Clock } from '@/shared/clock';
import type { BodyUseCases } from '../application/bodyUseCases';
import { BodyEntryDialog } from './BodyEntryDialog';
import { useBodySummary } from './useBodySummary';

type Props = { body: BodyUseCases; clock: Clock; timezone: string; run: (write: () => Promise<void>) => void };

/** In the Corps section of Suivi: the way to enter today's measures. */
export function BodyExtras({ body, clock, timezone, run }: Props) {
  const summary = useBodySummary(body, clock, timezone);
  const [entering, setEntering] = useState(false);
  return (
    <>
      <Button mode="outlined" icon="plus" contentStyle={styles.button} onPress={() => setEntering(true)}>
        Saisir une mesure
      </Button>
      {entering && (
        <BodyEntryDialog
          initial={summary?.today ?? {}}
          onCancel={() => setEntering(false)}
          onSave={(measure) => {
            run(async () => void (await body.save(measure)));
            setEntering(false);
          }}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({ button: { minHeight: 48 } });
