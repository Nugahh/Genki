import { useEffect, useState } from 'react';
import type { SettingsUseCases } from '../application/settingsUseCases';
import { DEFAULT_PROFILE, type Profile } from '../domain/profile';

/**
 * The profile, live: the stored fields over the defaults. `loaded` turns true with the first snapshot that knows the profile (not a
 * cache miss), so that a screen can tell « nothing chosen yet » (setup) from « not read yet ».
 */
export function useProfile(settings: SettingsUseCases): { profile: Profile; loaded: boolean } {
  const [state, setState] = useState<{ profile: Profile; loaded: boolean }>({ profile: DEFAULT_PROFILE, loaded: false });
  // Listener errors show on the SyncIcon, which watches the same user's data.
  useEffect(() => settings.observeProfile((profile, known) => setState({ profile, loaded: known }), () => {}), [settings]);
  return state;
}
