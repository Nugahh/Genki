import type { UiPrefs } from '../domain/ui';

export interface ProfileRepository {
  /** The display preferences, `{}` while none was chosen. Returns the unsubscribe function. */
  observeUi(onNext: (ui: UiPrefs) => void, onError: (error: Error) => void): () => void;
  /** Merges the given fields into the stored preferences; settles once the server has the write. */
  saveUi(ui: UiPrefs): Promise<void>;
}
