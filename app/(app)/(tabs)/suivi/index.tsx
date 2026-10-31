import { router } from 'expo-router';
import { useApp } from '@/appContext';
import { useUiPrefs } from '@/modules/settings';
import { goalsOf, SuiviHub } from '@/modules/tracking';

export default function Suivi() {
  const { app, profile, run } = useApp();
  const [ui, changeUi] = useUiPrefs(app.settings, run);
  if (!ui) return null; // the first snapshot is from the cache: no flash of defaults
  return (
    <SuiviHub
      tracking={app.tracking}
      goals={goalsOf(profile)}
      ui={ui}
      onUiChange={changeUi}
      clock={app.clock}
      timezone={app.profile.timezone}
      onOpen={(section, metric) => router.push({ pathname: '/suivi/[section]', params: { section, metric } })}
    />
  );
}
