import type { ProfileRepository } from '../application/ports';
import type { UiPrefs } from '../domain/ui';

/** ProfileRepository kept in memory, for tests. */
export function inMemoryProfileRepository(): ProfileRepository & { ui: UiPrefs } {
  const listeners = new Set<() => void>();
  const repo = {
    ui: {} as UiPrefs,
    observeUi(onNext: (ui: UiPrefs) => void) {
      const listener = () => onNext(repo.ui);
      listeners.add(listener);
      listener();
      return () => {
        listeners.delete(listener);
      };
    },
    async saveUi(ui: UiPrefs) {
      repo.ui = { ...repo.ui, ...ui };
      listeners.forEach((listener) => listener());
    },
  };
  return repo;
}
