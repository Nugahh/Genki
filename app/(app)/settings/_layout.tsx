import { Stack } from 'expo-router';

export default function SettingsLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'Réglages' }} />
      <Stack.Screen name="goals" options={{ title: 'Objectifs' }} />
      <Stack.Screen name="profile" options={{ title: 'Profil' }} />
      <Stack.Screen name="water" options={{ title: 'Eau' }} />
      <Stack.Screen name="steps" options={{ title: 'Pas' }} />
      <Stack.Screen name="tobacco" options={{ title: 'Tabac' }} />
      <Stack.Screen name="data" options={{ title: 'Données' }} />
    </Stack>
  );
}
