import { useApp } from '@/appContext';
import { StepsSettingsScreen } from '@/modules/steps';

export default function StepsSettings() {
  const { app, profile, stepsSync } = useApp();
  return <StepsSettingsScreen steps={app.steps} sync={stepsSync} timezone={profile.timezone} />;
}
