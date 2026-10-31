import { useCallback, useEffect, useState } from 'react';
import type { SettingsUseCases } from '../application/settingsUseCases';
import type { UiPrefs } from '../domain/ui';

/**
 * The display preferences, live. `update` merges the given fields: they show at once, and `run` writes them
 * (a refused write is offered again); whatever the next snapshot says then wins, from either phone.
 */
export function useUiPrefs(settings: SettingsUseCases, run: (write: () => Promise<void>) => void): [UiPrefs, (next: UiPrefs) => void] {
  const [prefs, setPrefs] = useState<UiPrefs>({});
  // Listener errors show on the SyncIcon, which watches the same user's data.
  useEffect(() => settings.observeUi(setPrefs, () => {}), [settings]);
  const update = useCallback(
    (next: UiPrefs) => {
      setPrefs((current) => ({ ...current, ...next }));
      run(() => settings.saveUi(next));
    },
    [settings, run],
  );
  return [prefs, update];
}
