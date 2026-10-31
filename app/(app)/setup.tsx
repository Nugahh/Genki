import { router } from 'expo-router';
import { useApp } from '@/appContext';
import { SetupScreen } from '@/modules/settings';
import { dayKey } from '@/shared/clock';

export default function Setup() {
  const { app, profile, run } = useApp();
  const year = Number(dayKey(app.clock.now(), profile.timezone).slice(0, 4));
  return (
    <SetupScreen
      profile={profile}
      year={year}
      onDone={(patch, weightKg) => {
        run(() => app.settings.saveProfile(patch));
        // The weight typed is the first measure.
        run(async () => void (await app.body.save({ weightKg })));
        router.replace('/');
      }}
      onSkip={() => {
        // Only the moment is stored: the defaults stay, and the screen is not shown again.
        run(() => app.settings.saveProfile({ createdAt: new Date() }));
        router.replace('/');
      }}
    />
  );
}
