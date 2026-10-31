import { Tabs } from 'expo-router/js-tabs';
import { Icon } from 'react-native-paper';
import { HeaderSync } from '@/HeaderSync';
import { MaterialTabBar } from '@/MaterialTabBar';

export default function TabsLayout() {
  return (
    // « history »: the back button of the phone goes back to the tab we came from (Suivi back to Today), not to the first tab.
    <Tabs backBehavior="history" tabBar={(props) => <MaterialTabBar {...props} />} screenOptions={{ headerRight: () => <HeaderSync /> }}>
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
      <Tabs.Screen
        name="sport"
        options={{
          title: 'Sport',
          tabBarIcon: ({ color, size }) => <Icon source="dumbbell" color={color as string} size={size} />,
        }}
      />
      <Tabs.Screen
        name="suivi"
        options={{
          title: 'Suivi',
          // Its stack has the headers: the hub's, and a section's with its back arrow.
          headerShown: false,
          // Mounted from the start, so that a section opened from Today lands on top of the hub (back goes to the hub).
          lazy: false,
          tabBarIcon: ({ color, size }) => <Icon source="chart-line" color={color as string} size={size} />,
        }}
      />
    </Tabs>
  );
}
