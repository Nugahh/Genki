import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useApp } from '@/appContext';
import { PlanScreen } from '@/modules/training';

export default function Plan() {
  const { app, run } = useApp();
  return (
    // Edge-to-edge: no tab bar here, so the last controls would sit under the system navigation bar.
    <SafeAreaView edges={['bottom']} style={{ flex: 1 }}>
      <PlanScreen training={app.training} run={run} onOpenHistory={(id, name) => router.push({ pathname: '/exercise', params: { id, name } })} />
    </SafeAreaView>
  );
}
