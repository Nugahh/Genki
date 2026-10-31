import { act, renderHook } from '@testing-library/react-native';
import { inMemoryProfileRepository } from '../adapters/inMemoryProfileRepository';
import { settingsUseCases } from '../application/settingsUseCases';
import { useUiPrefs } from './useUiPrefs';

test('starts with nothing chosen, changes at once, and writes through run', async () => {
  const repo = inMemoryProfileRepository();
  const settings = settingsUseCases(repo);
  const run = jest.fn((write: () => Promise<void>) => void write());
  const { result } = await renderHook(() => useUiPrefs(settings, run));
  // The in-memory repository answers at once; the first snapshot is `{}`: nothing chosen.
  expect(result.current[0]).toEqual({});

  await act(async () => result.current[1]({ period: 'day' }));
  expect(result.current[0]).toEqual({ period: 'day' });
  expect(run).toHaveBeenCalledTimes(1);
  expect(repo.ui).toEqual({ period: 'day' });
});

test('follows what another phone wrote', async () => {
  const repo = inMemoryProfileRepository();
  const settings = settingsUseCases(repo);
  const { result } = await renderHook(() => useUiPrefs(settings, (write) => void write()));
  await act(async () => repo.saveUi({ hubMetrics: ['steps'] }));
  expect(result.current[0]).toEqual({ hubMetrics: ['steps'] });
});

test('is null until the first snapshot', async () => {
  const settings = settingsUseCases({ ...inMemoryProfileRepository(), observeUi: () => () => {} });
  const { result } = await renderHook(() => useUiPrefs(settings, () => {}));
  expect(result.current[0]).toBeNull();
});
