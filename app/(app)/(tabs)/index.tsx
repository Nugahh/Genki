import { router } from 'expo-router';
import { useApp } from '@/appContext';
import { BodyCard } from '@/modules/body';
import { useAuthUser } from '@/platform/firebase';
import { defaultMeal } from '@/modules/nutrition';
import { TodayScreen } from '@/modules/today';
import { useNextSession } from '@/modules/training';
import { hourOfDay } from '@/shared/clock';

export default function Today() {
  const { app, profile, run } = useApp();
  const { clock, dayTotals, hydration } = app;
  const userName = useAuthUser()?.displayName?.split(' ')[0];
  const next = useNextSession(app.training, clock, profile.timezone);
  return (
    <TodayScreen
      profile={profile}
      userName={userName}
      clock={clock}
      dayTotals={dayTotals}
      hydration={hydration}
      run={run}
      onAddMeal={() => router.push({ pathname: '/add-food', params: { meal: defaultMeal(hourOfDay(clock.now(), profile.timezone)) } })}
      onOpenMetric={(metric) => router.navigate({ pathname: '/suivi/[section]', params: { section: 'nutrition', metric } })}
      cards={<BodyCard body={app.body} clock={clock} timezone={profile.timezone} run={run} onOpen={() => router.navigate({ pathname: '/suivi/[section]', params: { section: 'corps', metric: 'weight' } })} />}
      session={next && { title: next.title, subtitle: next.subtitle, onStart: () => router.push({ pathname: '/workout', params: { session: String(next.index) } }) }}
    />
  );
}
