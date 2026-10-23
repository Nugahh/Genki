import { Tabs } from 'expo-router';
import { useMemo } from 'react';
import { Icon } from 'react-native-paper';
import { AppProvider, useApp } from '@/appContext';
import { compose } from '@/composition';
import { SyncIcon } from '@/modules/today';
import { useAuthUser } from '@/platform/firebase';

function HeaderSync() {
  const { app, writeFailed } = useApp();
  return <SyncIcon dayTotals={app.dayTotals} clock={app.clock} timezone={app.profile.timezone} writeFailed={writeFailed} />;
}

export default function TabsLayout() {
  const uid = useAuthUser()?.uid;
  const app = useMemo(() => (uid ? compose(uid) : null), [uid]);
  if (!app) return null; // signed out: the root guard is leaving this screen

  return (
    <AppProvider app={app}>
      <Tabs screenOptions={{ headerRight: () => <HeaderSync /> }}>
        <Tabs.Screen
          name="index"
          options={{
            title: 'Aujourd’hui',
            // The tab bar's tints are theme color strings; Paper's Icon only types `string`.
            tabBarIcon: ({ color, size }) => <Icon source="calendar-today" color={color as string} size={size} />,
          }}
        />
      </Tabs>
    </AppProvider>
  );
}
