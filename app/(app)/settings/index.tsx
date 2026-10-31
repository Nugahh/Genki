import { router } from 'expo-router';
import { useApp } from '@/appContext';
import { SettingsScreen, type SettingsPage } from '@/modules/settings';

const PATH = {
  goals: '/settings/goals',
  profile: '/settings/profile',
  water: '/settings/water',
  tobacco: '/settings/tobacco',
  data: '/settings/data',
} as const satisfies Record<SettingsPage, string>;

export default function Settings() {
  const { profile } = useApp();
  return <SettingsScreen profile={profile} onOpen={(page) => router.push(PATH[page])} />;
}
