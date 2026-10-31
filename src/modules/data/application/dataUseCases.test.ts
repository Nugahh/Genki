import { inMemoryDataStore } from '../adapters/inMemoryDataStore';
import { dataUseCases } from './dataUseCases';

const clock = { now: () => new Date('2026-11-03T22:30:00Z') }; // 23:30 in Paris
const stamp = (iso: string) => ({ __timestamp: iso });

const account = () => ({
  profile: { heightCm: 180, createdAt: stamp('2026-10-01T10:00:00.000Z') },
  collections: {
    days: [{ id: '2026-11-02', data: { kcal: 800, proteinG: 50, carbsG: 90, fatG: 15, waterMl: 750, weightKg: 80, updatedAt: stamp('2026-11-02T20:00:00.000Z') } }],
    waterEntries: [
      { id: 'w1', data: { day: '2026-11-02', ml: 250, createdAt: stamp('2026-11-02T08:00:00.000Z'), deletedAt: null } },
      { id: 'w2', data: { day: '2026-11-02', ml: 500, createdAt: stamp('2026-11-02T09:00:00.000Z'), deletedAt: null } },
      { id: 'w3', data: { day: '2026-11-02', ml: 100, createdAt: stamp('2026-11-02T10:00:00.000Z'), deletedAt: stamp('2026-11-02T10:01:00.000Z') } },
    ],
    foodEntries: [{ id: 'f1', data: { day: '2026-11-02', macros: { kcal: 800, protein: 50, carbs: 90, fat: 15 }, deletedAt: null } }],
    milestones: [{ id: 'm1', data: { metric: 'waistCm', target: 90, direction: 'down', label: 'Tour de taille sous 90 cm', achievedAt: stamp('2026-11-02T10:00:00.000Z') } }],
  },
});

function setup(initial: Parameters<typeof inMemoryDataStore>[0] = account(), refuse: string[] = []) {
  const store = inMemoryDataStore(initial, refuse);
  return { store, data: dataUseCases({ store, clock, timezone: 'Europe/Paris' }) };
}

describe('export and import', () => {
  test('names the file with the day in the profile time zone, and holds the whole account', async () => {
    const { data } = setup();
    const { name, text } = await data.exportBackup();
    expect(name).toBe('genki-2026-11-03.json');
    const file = JSON.parse(text);
    expect(file).toMatchObject({ version: 1, exportedAt: '2026-11-03T22:30:00.000Z', profile: { heightCm: 180 } });
    expect(file.collections.waterEntries).toHaveLength(3);
  });

  test('an export restored into an empty account gives it back, minus what was deleted in the app', async () => {
    const { data } = setup();
    const { text } = await data.exportBackup();
    const target = setup({ profile: {}, collections: {} });
    const result = await target.data.importBackup(text);
    expect(result).toEqual({ written: 6, failed: 0, firstError: undefined }); // 1 + 2 + 1 + 1 creations, 1 milestone date
    const back = await target.store.readAll();
    expect(back.profile).toEqual(account().profile);
    expect(back.collections.waterEntries?.map((d) => d.id)).toEqual(['w1', 'w2']); // w3 was deleted
    expect(back.collections.milestones).toEqual(account().collections.milestones); // with the date it was reached
    expect(back.collections.days).toEqual(account().collections.days);
  });

  test('says what a backup holds before it is restored', () => {
    const { data } = setup();
    return data.exportBackup().then(({ text }) => {
      expect(data.previewBackup(text)).toEqual({ documents: 6, exportedAt: new Date('2026-11-03T22:30:00.000Z') });
    });
  });

  test('refuses what is not a backup, with the message, and writes nothing', async () => {
    const target = setup({ profile: {}, collections: {} });
    expect(() => target.data.previewBackup('pas du json')).toThrow('Ce fichier n’est pas une sauvegarde : ce n’est pas du JSON.');
    await expect(target.data.importBackup('{"version":3}')).rejects.toThrow('Ce fichier n’est pas une sauvegarde de cette version.');
    expect((await target.store.readAll()).collections.days).toEqual([]);
  });

  test('reports the documents the rules refused, and writes the others', async () => {
    const { data } = setup();
    const { text } = await data.exportBackup();
    const target = setup({ profile: {}, collections: {} }, ['w2']);
    expect(await target.data.importBackup(text)).toEqual({ written: 5, failed: 1, firstError: 'refused: w2' });
  });
});

describe('recomputeTotals', () => {
  test('corrects the days whose totals drifted, leaves the rest of the day alone, and says how many', async () => {
    const { store, data } = setup();
    // Stored: the totals the entries make (w3 is deleted), and 80 kg. Right already.
    expect(await data.recomputeTotals()).toEqual({ days: 1, corrected: 0 });

    store.docs.get('days')!.set('2026-11-02', { kcal: 1500, proteinG: 50, carbsG: 90, fatG: 15, waterMl: 750, weightKg: 80 });
    expect(await data.recomputeTotals()).toEqual({ days: 1, corrected: 1 });
    expect(store.docs.get('days')!.get('2026-11-02')).toMatchObject({ kcal: 800, proteinG: 50, waterMl: 750, weightKg: 80 });
  });

  test('creates the totals of a day that has entries and no document, and zeroes a document without entries', async () => {
    const { store, data } = setup({
      profile: {},
      collections: {
        days: [{ id: '2026-11-01', data: { kcal: 900 } }],
        waterEntries: [{ id: 'w1', data: { day: '2026-11-02', ml: 250, deletedAt: null } }],
      },
    });
    expect(await data.recomputeTotals()).toEqual({ days: 2, corrected: 2 });
    expect(store.docs.get('days')!.get('2026-11-01')).toMatchObject({ kcal: 0 });
    expect(store.docs.get('days')!.get('2026-11-02')).toMatchObject({ waterMl: 250 });
  });
});
