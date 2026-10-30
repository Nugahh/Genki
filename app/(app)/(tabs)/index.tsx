import { router } from 'expo-router';
import { useApp } from '@/appContext';
import { defaultMeal } from '@/modules/nutrition';
import { TodayScreen } from '@/modules/today';
import { hourOfDay } from '@/shared/clock';

export default function Today() {
  const { app, run } = useApp();
  const { clock, dayTotals, hydration, profile } = app;
  return (
    <TodayScreen
      profile={profile}
      clock={clock}
      dayTotals={dayTotals}
      hydration={hydration}
      run={run}
      onAddMeal={() => router.push({ pathname: '/add-food', params: { meal: defaultMeal(hourOfDay(clock.now(), profile.timezone)) } })}
      onOpenMeals={() => router.navigate('/repas')}
    />
  );
}
