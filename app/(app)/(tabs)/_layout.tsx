import { Tabs } from 'expo-router/js-tabs';
import { Icon } from 'react-native-paper';
import { useApp } from '@/appContext';
import { SyncIcon } from '@/modules/today';

function HeaderSync() {
  const { app, writeFailed } = useApp();
  return <SyncIcon dayTotals={app.dayTotals} clock={app.clock} timezone={app.profile.timezone} writeFailed={writeFailed} />;
}

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerRight: () => <HeaderSync /> }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Aujourd’hui',
          // The tab bar's tints are theme color strings; Paper's Icon only types `string`.
          tabBarIcon: ({ color, size }) => <Icon source="calendar-today" color={color as string} size={size} />,
        }}
      />
      <Tabs.Screen
        name="repas"
        options={{
          title: 'Repas',
          tabBarIcon: ({ color, size }) => <Icon source="silverware-fork-knife" color={color as string} size={size} />,
        }}
      />
    </Tabs>
  );
}
