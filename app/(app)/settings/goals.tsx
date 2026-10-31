import { router } from 'expo-router';
import { useApp } from '@/appContext';
import { useBodySummary } from '@/modules/body';
import { GoalsScreen } from '@/modules/settings';
import { dayKey } from '@/shared/clock';

export default function Goals() {
  const { app, profile, run } = useApp();
  const body = useBodySummary(app.body, app.clock, profile.timezone);
  const year = Number(dayKey(app.clock.now(), profile.timezone).slice(0, 4));
  const weightKg = body?.weightAverage ?? body?.today.weightKg;
  return (
    <GoalsScreen
      // The weight starts the proposal and only seeds the field: when it is learnt, the screen starts again with it.
      key={weightKg === undefined ? 'no-weight' : 'weight'}
      profile={profile}
      weightKg={weightKg}
      year={year}
      onSave={(patch) => {
        run(() => app.settings.saveProfile(patch));
        router.back();
      }}
    />
  );
}
