import { router } from 'expo-router';
import { useApp } from '@/appContext';
import { MealsScreen } from '@/modules/nutrition';

export default function Meals() {
  const { app, run } = useApp();
  return (
    <MealsScreen
      profile={app.profile}
      clock={app.clock}
      meals={app.nutrition.meals}
      onAdd={(meal) => router.push({ pathname: '/add-food', params: { meal } })}
      run={run}
    />
  );
}
