import { useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useApp } from '@/appContext';
import { ExerciseHistoryScreen } from '@/modules/training';

export default function Exercise() {
  const { app } = useApp();
  const { id, name } = useLocalSearchParams<{ id?: string; name?: string }>();
  return (
    <SafeAreaView edges={['bottom']} style={{ flex: 1 }}>
      <ExerciseHistoryScreen training={app.training} exerciseId={id ?? ''} name={name ?? ''} />
    </SafeAreaView>
  );
}
