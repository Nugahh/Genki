export { DEFAULT_PROFILE, type Profile, type WaterContainer } from './domain/profile';
export type { UiPrefs } from './domain/ui';
export { settingsUseCases, type SettingsUseCases } from './application/settingsUseCases';
export { inMemoryProfileRepository } from './adapters/inMemoryProfileRepository';
export { useUiPrefs } from './ui/useUiPrefs';
