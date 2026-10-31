import { Stack } from 'expo-router';
import { HeaderSync } from '@/HeaderSync';

// Opened straight on a section (from Today), the hub is under it: back goes to the hub.
export const unstable_settings = { initialRouteName: 'index' };

export default function SuiviLayout() {
  return (
    <Stack screenOptions={{ headerRight: () => <HeaderSync /> }}>
      <Stack.Screen name="index" options={{ title: 'Suivi' }} />
      <Stack.Screen name="[section]" />
    </Stack>
  );
}
