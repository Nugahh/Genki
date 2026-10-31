import { act, renderHook } from '@testing-library/react-native';
import { inMemoryProfileRepository } from '../adapters/inMemoryProfileRepository';
import { settingsUseCases } from '../application/settingsUseCases';
import { DEFAULT_PROFILE } from '../domain/profile';
import { useProfile } from './useProfile';

test('starts with the defaults and follows what is stored', async () => {
  const settings = settingsUseCases(inMemoryProfileRepository());
  const { result } = await renderHook(() => useProfile(settings));
  // The in-memory repository answers at once: nothing stored, so the defaults, read.
  expect(result.current).toEqual({ profile: DEFAULT_PROFILE, loaded: true });
  await act(async () => settings.saveProfile({ goalMode: 'deficit' }));
  expect(result.current.profile.goalMode).toBe('deficit');
});

test('is not loaded before the first snapshot', async () => {
  const settings = settingsUseCases({ ...inMemoryProfileRepository(), observeProfile: () => () => {} });
  const { result } = await renderHook(() => useProfile(settings));
  expect(result.current).toEqual({ profile: DEFAULT_PROFILE, loaded: false });
});

test('a snapshot that only says « not in the cache » is not a profile read: nothing is known yet', async () => {
  let emit: (known: boolean) => void = () => {};
  const settings = settingsUseCases({ ...inMemoryProfileRepository(), observeProfile: (onNext) => ((emit = (known) => onNext({}, known)), () => {}) });
  const { result } = await renderHook(() => useProfile(settings));
  await act(async () => emit(false));
  expect(result.current.loaded).toBe(false);
  await act(async () => emit(true));
  expect(result.current.loaded).toBe(true);
});
