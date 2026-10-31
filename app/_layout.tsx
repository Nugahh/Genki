import { Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'react-native';
import { PaperProvider } from 'react-native-paper';
import { useAuthUser } from '@/platform/firebase';
import { navigationTheme, theme } from '@/theme';

export default function RootLayout() {
  const signedIn = useAuthUser() !== null;
  // The app is light-only: without these, Paper, the navigation chrome and the status bar follow the phone's dark mode.
  return (
    <PaperProvider theme={theme}>
      <ThemeProvider value={navigationTheme}>
        <StatusBar barStyle="dark-content" />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Protected guard={signedIn}>
            <Stack.Screen name="(app)" />
          </Stack.Protected>
          <Stack.Protected guard={!signedIn}>
            <Stack.Screen name="sign-in" />
          </Stack.Protected>
        </Stack>
      </ThemeProvider>
    </PaperProvider>
  );
}
