import { inMemoryProfileRepository } from '../adapters/inMemoryProfileRepository';
import { settingsUseCases } from './settingsUseCases';

test('shows nothing chosen until something is saved, then what was saved, merged', async () => {
  const settings = settingsUseCases(inMemoryProfileRepository());
  const seen: unknown[] = [];
  settings.observeUi((ui) => seen.push(ui), () => {});
  await settings.saveUi({ hubMetrics: ['water'] });
  await settings.saveUi({ period: 'year' });
  expect(seen).toEqual([{}, { hubMetrics: ['water'] }, { hubMetrics: ['water'], period: 'year' }]);
});

test('refuses invalid preferences with the message, and writes nothing', async () => {
  const repo = inMemoryProfileRepository();
  const settings = settingsUseCases(repo);
  await expect(settings.saveUi({ hubMetrics: ['a', 'a'] })).rejects.toThrow('Une statistique ne peut apparaître qu’une fois.');
  expect(repo.ui).toEqual({});
});
