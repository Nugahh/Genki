import { validateUi, type UiPrefs } from '../domain/ui';
import type { ProfileRepository } from './ports';

export function settingsUseCases(repo: ProfileRepository) {
  return {
    observeUi: repo.observeUi,
    async saveUi(ui: UiPrefs) {
      const problem = validateUi(ui);
      if (problem) throw new Error(problem);
      return repo.saveUi(ui);
    },
  };
}

export type SettingsUseCases = ReturnType<typeof settingsUseCases>;
