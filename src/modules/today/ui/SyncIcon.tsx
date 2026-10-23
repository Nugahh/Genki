import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Icon } from 'react-native-paper';
import { dayKey, type Clock } from '@/shared/clock';
import { useNow } from '@/shared/useNow';
import type { DayTotalsRepository } from '../application/ports';
import { syncStatus, type SyncMeta, type SyncStatus } from '../domain/sync';

const LOOK: Record<SyncStatus, { icon: string; label: string }> = {
  synced: { icon: 'cloud-check-outline', label: 'Synchronisé' },
  pending: { icon: 'cloud-upload-outline', label: 'En attente d’envoi' },
  offline: { icon: 'cloud-off-outline', label: 'Hors-ligne' },
  error: { icon: 'cloud-alert', label: 'Erreur de synchronisation' },
};

type Props = { dayTotals: DayTotalsRepository; clock: Clock; timezone: string; writeFailed: boolean };

/** Top-bar cloud, from today's totals snapshot metadata (spec §6): every write of the day touches that document. */
export function SyncIcon({ dayTotals, clock, timezone, writeFailed }: Props) {
  const day = dayKey(useNow(clock), timezone);
  const [meta, setMeta] = useState<SyncMeta>({ hasPendingWrites: false, fromCache: true });
  const [listenFailed, setListenFailed] = useState(false);

  useEffect(
    () =>
      dayTotals.observe(
        day,
        (_, sync) => {
          setMeta(sync);
          setListenFailed(false);
        },
        () => setListenFailed(true),
      ),
    [dayTotals, day],
  );

  const look = LOOK[syncStatus(meta, writeFailed || listenFailed)];
  return (
    <View accessible accessibilityLabel={look.label} style={styles.icon}>
      <Icon source={look.icon} size={24} />
    </View>
  );
}

const styles = StyleSheet.create({ icon: { marginHorizontal: 16 } });
