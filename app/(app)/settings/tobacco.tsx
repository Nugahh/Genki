import { router } from 'expo-router';
import { useApp } from '@/appContext';
import { TobaccoSettingsScreen } from '@/modules/settings';
import { dayKey } from '@/shared/clock';

export default function TobaccoSettings() {
  const { app, profile, run } = useApp();
  return (
    <TobaccoSettingsScreen
      profile={profile}
      today={dayKey(app.clock.now(), profile.timezone)}
      onSave={(patch) => {
        run(() => app.settings.saveProfile(patch));
        router.back();
      }}
    />
  );
}
