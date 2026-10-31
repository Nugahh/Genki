import { router } from 'expo-router';
import { View } from 'react-native';
import { IconButton } from 'react-native-paper';
import { useApp } from '@/appContext';
import { SyncIcon } from '@/modules/today';

/** The top right of every tab header: the sync cloud, and the way to the settings. */
export function HeaderActions() {
  const { app, writeFailed } = useApp();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <SyncIcon dayTotals={app.dayTotals} clock={app.clock} timezone={app.profile.timezone} writeFailed={writeFailed} />
      <IconButton icon="cog-outline" accessibilityLabel="Réglages" style={{ width: 48, height: 48, borderRadius: 24 }} onPress={() => router.push('/settings')} />
    </View>
  );
}
