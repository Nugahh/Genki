import { router } from 'expo-router';
import { useApp } from '@/appContext';
import { useBodySummary } from '@/modules/body';
import { GoalsScreen } from '@/modules/settings';
import { dayKey } from '@/shared/clock';

export default function Goals() {
  const { app, profile, run } = useApp();
  const body = useBodySummary(app.body, app.clock, profile.timezone);
  const year = Number(dayKey(app.clock.now(), profile.timezone).slice(0, 4));
  if (!body) return null; // the weight starts the proposal: the screen waits for it
  return (
    <GoalsScreen
      profile={profile}
      weightKg={body.weightAverage ?? body.today.weightKg}
      year={year}
      onSave={(patch) => {
        run(() => app.settings.saveProfile(patch));
        router.back();
      }}
    />
  );
}
