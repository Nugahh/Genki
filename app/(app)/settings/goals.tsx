import { router } from 'expo-router';
import { useApp } from '@/appContext';
import { GoalsScreen } from '@/modules/settings';
import { dayKey } from '@/shared/clock';

export default function Goals() {
  const { app, profile, run } = useApp();
  const year = Number(dayKey(app.clock.now(), profile.timezone).slice(0, 4));
  return (
    <GoalsScreen
      profile={profile}
      year={year}
      onSave={(patch) => {
        run(() => app.settings.saveProfile(patch));
        router.back();
      }}
    />
  );
}
