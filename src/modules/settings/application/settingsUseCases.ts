import { validateProfile, withDefaults, type Profile } from '../domain/profile';
import { validateUi, type UiPrefs } from '../domain/ui';
import type { ProfilePatch, ProfileRepository } from './ports';

export function settingsUseCases(repo: ProfileRepository) {
  return {
    observeUi: repo.observeUi,
    async saveUi(ui: UiPrefs) {
      const problem = validateUi(ui);
      if (problem) throw new Error(problem);
      return repo.saveUi(ui);
    },

    /** The profile as the app uses it: what was stored over the defaults. */
    observeProfile(onNext: (profile: Profile, known: boolean) => void, onError: (error: Error) => void) {
      return repo.observeProfile((stored, known) => onNext(withDefaults(stored), known), onError);
    },
    /** Checks the fields of the patch (each against the others' defaults) and merges them; a field at null is taken off. */
    async saveProfile(patch: ProfilePatch) {
      const given = Object.fromEntries(Object.entries(patch).filter(([, value]) => value !== null && value !== undefined)) as Partial<Profile>;
      const problem = validateProfile(withDefaults(given));
      if (problem) throw new Error(problem);
      return repo.saveProfile(patch);
    },
  };
}

export type SettingsUseCases = ReturnType<typeof settingsUseCases>;
