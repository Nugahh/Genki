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

describe('the profile', () => {
  test('is the stored fields over the defaults, the goals field by field', async () => {
    const settings = settingsUseCases(inMemoryProfileRepository());
    const seen: { kcal: number; steps: number; heightCm: number }[] = [];
    settings.observeProfile((p) => seen.push({ kcal: p.goals.kcal, steps: p.goals.steps, heightCm: p.heightCm }), () => {});
    await settings.saveProfile({ heightCm: 182, goals: { kcal: 2100 } as never });
    expect(seen).toEqual([
      { kcal: 2200, steps: 8000, heightCm: 175 },
      { kcal: 2100, steps: 8000, heightCm: 182 },
    ]);
  });

  test('takes an optional field off when it is set to null', async () => {
    const repo = inMemoryProfileRepository();
    const settings = settingsUseCases(repo);
    await settings.saveProfile({ quitDate: '2026-10-01', packPrice: 11 });
    await settings.saveProfile({ quitDate: null });
    expect(repo.stored).toEqual({ packPrice: 11 });
  });

  test('refuses a value out of its bounds with the message, and writes nothing', async () => {
    const repo = inMemoryProfileRepository();
    const settings = settingsUseCases(repo);
    await expect(settings.saveProfile({ heightCm: 90 })).rejects.toThrow('La taille est comprise entre 100 et 250 cm.');
    await expect(settings.saveProfile({ goals: { kcal: 100 } as never })).rejects.toThrow('Les calories sont comprises entre 800 et 10 000 par jour.');
    expect(repo.stored).toEqual({});
  });
});
