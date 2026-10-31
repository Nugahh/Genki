import { router, useLocalSearchParams, usePreventRemove } from 'expo-router';
import { useState } from 'react';
import { Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useApp } from '@/appContext';
import { WorkoutScreen } from '@/modules/training';

export default function Workout() {
  const { app, run } = useApp();
  const { session } = useLocalSearchParams<{ session?: string }>();
  // Sets ticked off are only written at the end: leaving before that loses them, so it asks first.
  const [dirty, setDirty] = useState(false);
  usePreventRemove(dirty, ({ repeat }) => {
    Alert.alert('Abandonner la séance ?', 'Les séries cochées seront perdues.', [
      { text: 'Continuer la séance', style: 'cancel' },
      {
        text: 'Abandonner',
        style: 'destructive',
        onPress: () => {
          setDirty(false);
          repeat();
        },
      },
    ]);
  });

  return (
    // Edge-to-edge: no tab bar here, so the bar with « Terminer » would sit under the system navigation bar.
    <SafeAreaView edges={['bottom']} style={{ flex: 1 }}>
      <WorkoutScreen
        profile={app.profile}
        clock={app.clock}
        training={app.training}
        sessionIndex={Number(session) || 0}
        run={run}
        onDone={() => router.back()}
        onDirtyChange={setDirty}
      />
    </SafeAreaView>
  );
}
