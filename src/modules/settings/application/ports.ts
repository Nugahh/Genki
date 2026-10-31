import type { Profile } from '../domain/profile';
import type { UiPrefs } from '../domain/ui';

/** What is stored of the profile: only the fields that were ever chosen. */
export type StoredProfile = Partial<Profile>;
/** A change to the profile: a field set to null is taken off (an optional one, such as the quit date). */
export type ProfilePatch = { [K in keyof Profile]?: Profile[K] | null };

export interface ProfileRepository {
  /** The display preferences, `{}` while none was chosen. Returns the unsubscribe function. */
  observeUi(onNext: (ui: UiPrefs) => void, onError: (error: Error) => void): () => void;
  /** Merges the given fields into the stored preferences; settles once the server has the write. */
  saveUi(ui: UiPrefs): Promise<void>;
  /**
   * The stored profile (`{}` while nothing was chosen), live. `known` is false for a snapshot that only says « not in the cache »
   * (a new phone not yet connected): nothing can be told of the profile from it. Returns the unsubscribe function.
   */
  observeProfile(onNext: (stored: StoredProfile, known: boolean) => void, onError: (error: Error) => void): () => void;
  /** Merges the fields into the stored profile (`goals` field by field); settles once the server has the write. */
  saveProfile(patch: ProfilePatch): Promise<void>;
}
