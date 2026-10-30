import { router, useLocalSearchParams } from 'expo-router';
import { useApp } from '@/appContext';
import { AddFoodScreen, MEALS } from '@/modules/nutrition';

export default function AddFood() {
  const { app, run } = useApp();
  const { meal } = useLocalSearchParams<{ meal?: string }>();
  // A link with no meal, or an unknown one, adds to the snacks.
  return (
    <AddFoodScreen
      meal={MEALS.find((m) => m === meal) ?? 'snack'}
      meals={app.nutrition.meals}
      foods={app.nutrition.foods}
      run={run}
      onDone={() => router.back()}
    />
  );
}
