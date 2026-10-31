import { Redirect } from 'expo-router';
import { useApp } from '@/appContext';
import { SetupScreen } from '@/modules/settings';
import { dayKey } from '@/shared/clock';

export default function Setup() {
  const { app, profile, run } = useApp();
  // Done (here, or on the other phone, or the snapshot of the write just made): nothing to ask.
  if (profile.createdAt) return <Redirect href="/" />;
  const year = Number(dayKey(app.clock.now(), profile.timezone).slice(0, 4));
  return (
    <SetupScreen
      profile={profile}
      year={year}
      onDone={(patch, weightKg) => {
        run(() => app.settings.saveProfile(patch));
        // The weight typed is the first measure.
        run(async () => void (await app.body.save({ weightKg })));
      }}
      onSkip={() => {
        // Only the moment is stored: the defaults stay, and the screen is not shown again.
        run(() => app.settings.saveProfile({ createdAt: new Date() }));
      }}
    />
  );
}
