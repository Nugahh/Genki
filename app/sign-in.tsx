import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, HelperText, Text } from 'react-native-paper';
import { signInWithGoogle } from '@/platform/firebase';

export default function SignIn() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signIn = () => {
    setBusy(true);
    setError(null);
    signInWithGoogle()
      .catch((e: unknown) => setError(`La connexion a échoué : ${e instanceof Error ? e.message : String(e)}. Réessaie.`))
      .finally(() => setBusy(false));
  };

  return (
    <View style={styles.screen}>
      <Text variant="headlineMedium">Genki</Text>
      <Button mode="contained" icon="google" onPress={signIn} loading={busy} disabled={busy} contentStyle={styles.button}>
        Se connecter avec Google
      </Button>
      <HelperText type="error" visible={error !== null}>
        {error}
      </HelperText>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 },
  button: { minHeight: 48 },
});
