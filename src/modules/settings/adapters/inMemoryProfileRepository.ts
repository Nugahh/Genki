import type { ProfilePatch, ProfileRepository, StoredProfile } from '../application/ports';
import type { UiPrefs } from '../domain/ui';

/** ProfileRepository kept in memory, for tests. */
export function inMemoryProfileRepository(): ProfileRepository & { ui: UiPrefs; stored: StoredProfile } {
  const uiListeners = new Set<() => void>();
  const profileListeners = new Set<() => void>();
  const repo = {
    ui: {} as UiPrefs,
    stored: {} as StoredProfile,
    observeUi(onNext: (ui: UiPrefs) => void) {
      const listener = () => onNext(repo.ui);
      uiListeners.add(listener);
      listener();
      return () => {
        uiListeners.delete(listener);
      };
    },
    async saveUi(ui: UiPrefs) {
      repo.ui = { ...repo.ui, ...ui };
      uiListeners.forEach((listener) => listener());
    },
    observeProfile(onNext: (stored: StoredProfile) => void) {
      const listener = () => onNext(repo.stored);
      profileListeners.add(listener);
      listener();
      return () => {
        profileListeners.delete(listener);
      };
    },
    async saveProfile(patch: ProfilePatch) {
      const next: Record<string, unknown> = { ...repo.stored };
      for (const [key, value] of Object.entries(patch)) {
        if (value === null) delete next[key];
        else if (key === 'goals') next.goals = { ...repo.stored.goals, ...(value as object) };
        else if (value !== undefined) next[key] = value;
      }
      repo.stored = next as StoredProfile;
      profileListeners.forEach((listener) => listener());
    },
  };
  return repo;
}
