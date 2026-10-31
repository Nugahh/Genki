import { router } from 'expo-router';
import { useApp } from '@/appContext';
import { WaterContainersScreen } from '@/modules/settings';

export default function WaterContainers() {
  const { app, profile, run } = useApp();
  return (
    <WaterContainersScreen
      profile={profile}
      onSave={(patch) => {
        run(() => app.settings.saveProfile(patch));
        router.back();
      }}
    />
  );
}
