import { Nunito_400Regular, Nunito_600SemiBold, useFonts } from '@expo-google-fonts/nunito';
import { Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'react-native';
import { PaperProvider } from 'react-native-paper';
import { useAuthUser } from '@/platform/firebase';
import { navigationTheme, theme } from '@/theme';

export default function RootLayout() {
  const signedIn = useAuthUser() !== null;
  const [fontsLoaded] = useFonts({ Nunito_400Regular, Nunito_600SemiBold });
  // The first frame waits for the font, or the text would change face under the eye.
  if (!fontsLoaded) return null;
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
