import { Redirect, Stack, usePathname } from 'expo-router';
import { useMemo } from 'react';
import { AppProvider, useApp } from '@/appContext';
import { compose } from '@/composition';
import { useAuthUser } from '@/platform/firebase';

/** The stack of the app; a profile nothing was ever stored in goes to the setup screen first (spec §6). */
function AppStack() {
  const { profile, profileLoaded } = useApp();
  const pathname = usePathname();
  if (profileLoaded && !profile.createdAt && pathname !== '/setup') return <Redirect href="/setup" />;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="settings" />
      <Stack.Screen name="setup" options={{ headerShown: true, title: 'Bienvenue' }} />
      <Stack.Screen name="workout" options={{ headerShown: true, title: 'Séance' }} />
      <Stack.Screen name="plan" options={{ headerShown: true, title: 'Mon programme' }} />
      <Stack.Screen name="exercise" options={{ headerShown: true, title: 'Historique' }} />
      <Stack.Screen name="add-food" options={{ presentation: 'modal', headerShown: true, title: 'Ajouter un aliment' }} />
    </Stack>
  );
}

export default function AppLayout() {
  const uid = useAuthUser()?.uid;
  const app = useMemo(() => (uid ? compose(uid) : null), [uid]);
  if (!app) return null; // signed out: the root guard is leaving this screen

  // The provider sits above the stack, so the modal shares the app and the « Réessayer » message with the tabs.
  return (
    <AppProvider app={app}>
      <AppStack />
    </AppProvider>
  );
}
