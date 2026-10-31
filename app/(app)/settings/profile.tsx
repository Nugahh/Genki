import { router } from 'expo-router';
import { useApp } from '@/appContext';
import { ProfileScreen } from '@/modules/settings';

export default function Profile() {
  const { app, profile, run } = useApp();
  return (
    <ProfileScreen
      profile={profile}
      onSave={(patch) => {
        run(() => app.settings.saveProfile(patch));
        router.back();
      }}
    />
  );
}
