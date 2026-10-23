import { Stack } from 'expo-router';
import { PaperProvider } from 'react-native-paper';
import { useAuthUser } from '@/platform/firebase';

export default function RootLayout() {
  const signedIn = useAuthUser() !== null;
  return (
    <PaperProvider>
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
