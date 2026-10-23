import { Stack } from 'expo-router';
import { StatusBar } from 'react-native';
import { MD3LightTheme, PaperProvider } from 'react-native-paper';
import { useAuthUser } from '@/platform/firebase';

export default function RootLayout() {
  const signedIn = useAuthUser() !== null;
  // The app is light-only: without these, Paper and the status bar follow the phone's dark mode.
  return (
    <PaperProvider theme={MD3LightTheme}>
      <StatusBar barStyle="dark-content" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Protected guard={signedIn}>
          <Stack.Screen name="(tabs)" />
        </Stack.Protected>
        <Stack.Protected guard={!signedIn}>
          <Stack.Screen name="sign-in" />
        </Stack.Protected>
      </Stack>
    </PaperProvider>
  );
}
