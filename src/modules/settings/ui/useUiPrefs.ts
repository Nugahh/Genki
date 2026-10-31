import { useCallback, useEffect, useState } from 'react';
import type { SettingsUseCases } from '../application/settingsUseCases';
import type { UiPrefs } from '../domain/ui';

/**
 * The display preferences, live; null until the first snapshot, so that a screen does not draw its defaults and then jump.
 * `update` merges the given fields: they show at once, and `run` writes them (a refused write is offered again);
 * whatever the next snapshot says then wins, from either phone.
 */
export function useUiPrefs(settings: SettingsUseCases, run: (write: () => Promise<void>) => void): [UiPrefs | null, (next: UiPrefs) => void] {
  const [prefs, setPrefs] = useState<UiPrefs | null>(null);
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
