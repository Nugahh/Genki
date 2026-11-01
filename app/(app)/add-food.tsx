import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useApp } from '@/appContext';
import { AddFoodScreen, MEALS, referencesOf } from '@/modules/nutrition';

export default function AddFood() {
  const { app, profile, run } = useApp();
  const { meal } = useLocalSearchParams<{ meal?: string }>();
  // A link with no meal, or an unknown one, adds to the snacks.
  // Edge-to-edge: no tab bar here, so the last controls would sit under the system navigation bar.
  return (
    <SafeAreaView edges={['bottom']} style={{ flex: 1 }}>
      <AddFoodScreen
        meal={MEALS.find((m) => m === meal) ?? 'snack'}
        meals={app.nutrition.meals}
        foods={app.nutrition.foods}
        references={referencesOf(profile)}
        run={run}
        onDone={() => router.back()}
      />
    </SafeAreaView>
  );
}
