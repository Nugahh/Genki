import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { PaperProvider } from 'react-native-paper';
import { theme } from '@/theme';
import { inMemoryDataStore } from '../adapters/inMemoryDataStore';
import { dataUseCases } from '../application/dataUseCases';
import { DataScreen } from './DataScreen';

const clock = { now: () => new Date('2026-11-03T10:00:00Z') };
const stamp = (iso: string) => ({ __timestamp: iso });
const account = () => ({
  profile: { heightCm: 180 },
  collections: {
    days: [{ id: '2026-11-02', data: { kcal: 1500, updatedAt: stamp('2026-11-02T20:00:00.000Z') } }],
    waterEntries: [{ id: 'w1', data: { day: '2026-11-02', ml: 250, createdAt: stamp('2026-11-02T08:00:00.000Z'), deletedAt: null } }],
  },
});

async function setup(options: { picked?: string | null; refuse?: string[]; source?: ReturnType<typeof account> } = {}) {
  const store = inMemoryDataStore(options.source ?? account(), options.refuse);
  const data = dataUseCases({ store, clock, timezone: 'Europe/Paris' });
  const shared: { name: string; text: string }[] = [];
  const files = {
    share: jest.fn<Promise<void>, [string, string]>(async (name, text) => {
      shared.push({ name, text });
    }),
    pick: jest.fn(async () => options.picked ?? null),
  };
  await render(
    <PaperProvider theme={theme}>
      <DataScreen data={data} files={files} />
    </PaperProvider>,
  );
  return { store, data, files, shared };
}

test('exports the account to a file named after the day, and says so', async () => {
  const { shared } = await setup();
  await fireEvent.press(screen.getByText('Exporter mes données'));
  expect(await screen.findByText('Sauvegarde exportée.')).toBeTruthy();
  expect(shared[0].name).toBe('genki-2026-11-03.json');
  expect(JSON.parse(shared[0].text).collections.waterEntries).toHaveLength(1);
});

test('says why an export failed', async () => {
  const { files } = await setup();
  files.share.mockRejectedValueOnce(new Error('Le partage n’est pas disponible sur cet appareil.'));
  await fireEvent.press(screen.getByText('Exporter mes données'));
  expect(await screen.findByText('Le partage n’est pas disponible sur cet appareil.')).toBeTruthy();
});

describe('import', () => {
  const backupText = async () => {
    const { data } = await setup();
    return (await data.exportBackup()).text;
  };

  test('shows what the file holds and asks before it writes, then says what was restored', async () => {
    const text = await backupText();
    const { store } = await setup({ picked: text, source: { profile: {}, collections: {} } as never });
    await fireEvent.press(screen.getByText('Importer une sauvegarde'));
    expect(await screen.findByText('Importer 3 documents ?')).toBeTruthy();
    expect((await store.readAll()).collections.days).toEqual([]); // nothing written yet
    await fireEvent.press(screen.getByText('Importer'));
    expect(await screen.findByText('3 documents restaurés.')).toBeTruthy();
    expect((await store.readAll()).collections.days).toHaveLength(1);
  });

  test('does nothing when the picker is cancelled', async () => {
    await setup({ picked: null });
    await fireEvent.press(screen.getByText('Importer une sauvegarde'));
    expect(screen.queryByText(/^Importer \d/)).toBeNull();
  });

  test('refuses a file that is not a backup, with the reason, before asking anything', async () => {
    await setup({ picked: 'pas du json' });
    await fireEvent.press(screen.getByText('Importer une sauvegarde'));
    expect(await screen.findByText('Ce fichier n’est pas une sauvegarde : ce n’est pas du JSON.')).toBeTruthy();
  });

  test('says what the rules refused, in the colour of an error', async () => {
    const text = await backupText();
    await setup({ picked: text, refuse: ['w1'], source: { profile: {}, collections: {} } as never });
    await fireEvent.press(screen.getByText('Importer une sauvegarde'));
    await fireEvent.press(await screen.findByText('Importer'));
    const message = await screen.findByText('2 documents restaurés, 1 refusé : refused: w1');
    expect(message.props.accessibilityLiveRegion).toBe('polite');
  });

  test('cancelling the question writes nothing', async () => {
    const text = await backupText();
    const { store } = await setup({ picked: text, source: { profile: {}, collections: {} } as never });
    await fireEvent.press(screen.getByText('Importer une sauvegarde'));
    await fireEvent.press(await screen.findByText('Annuler'));
    expect((await store.readAll()).collections.days).toEqual([]);
  });
});

describe('recompute', () => {
  test('asks, then says how many days were wrong', async () => {
    await setup(); // the day says 1 500 kcal, has no food entry and no water: it is put right
    await fireEvent.press(screen.getByText('Recalculer les totaux'));
    expect(screen.getByText('Recalculer les totaux de tous les jours ?')).toBeTruthy();
    await fireEvent.press(screen.getByText('Recalculer'));
    expect(await screen.findByText('1 jour corrigé sur 1.')).toBeTruthy();
  });

  test('says when they were right', async () => {
    await setup({ source: { profile: {}, collections: { days: [{ id: '2026-11-02', data: { waterMl: 250, kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 } }], waterEntries: account().collections.waterEntries } } as never });
    await fireEvent.press(screen.getByText('Recalculer les totaux'));
    await fireEvent.press(screen.getByText('Recalculer'));
    expect(await screen.findByText('Les totaux de 1 jour étaient justes.')).toBeTruthy();
  });
});

test('keeps the buttons from being pressed twice at once', async () => {
  const { files } = await setup();
  let release: () => void = () => {};
  files.share.mockImplementationOnce(() => new Promise<void>((resolve) => (release = resolve)));
  await fireEvent.press(screen.getByText('Exporter mes données'));
  expect(screen.getByText('Importer une sauvegarde')).toBeDisabled();
  await act(async () => release());
  expect(await screen.findByText('Sauvegarde exportée.')).toBeTruthy();
});
