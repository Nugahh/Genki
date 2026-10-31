import { router } from 'expo-router';
import { useApp } from '@/appContext';
import { useUiPrefs } from '@/modules/settings';
import { SuiviHub } from '@/modules/tracking';

export default function Suivi() {
  const { app, run } = useApp();
  const [ui, changeUi] = useUiPrefs(app.settings, run);
  return (
    <SuiviHub
      tracking={app.tracking}
      ui={ui}
      onUiChange={changeUi}
      clock={app.clock}
      timezone={app.profile.timezone}
      onOpen={(section, metric) => router.push({ pathname: '/suivi/[section]', params: { section, metric } })}
    />
  );
}
