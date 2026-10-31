import { act, fireEvent, render, renderHook, screen } from '@testing-library/react-native';
import { AppState } from 'react-native';
import { PaperProvider } from 'react-native-paper';
import { theme } from '@/theme';
import { inMemoryHealthSource } from '../adapters/inMemoryHealthSource';
import { inMemoryStepsRepository } from '../adapters/inMemoryStepsRepository';
import { stepsUseCases } from '../application/stepsUseCases';
import { FITBIT_PACKAGE } from '../domain/steps';
import { outcomeProblem, outcomeText } from './outcomeText';
import { StepsExtras } from './StepsExtras';
import { StepsSettingsScreen } from './StepsSettingsScreen';
import { useStepsSync } from './useStepsSync';

const clock = { now: () => new Date('2026-11-03T10:00:00Z') }; // 11:00 in Paris
const phone = { id: 'phone-a', name: 'Pixel' };
const draw = (ui: React.ReactElement) => render(<PaperProvider theme={theme}>{ui}</PaperProvider>);

function setup(options: { health?: ReturnType<typeof inMemoryHealthSource>; repo?: ReturnType<typeof inMemoryStepsRepository> } = {}) {
  const health = options.health ?? inMemoryHealthSource({ days: { '2026-11-03': { steps: 4200, origins: [FITBIT_PACKAGE] } } });
  const repo = options.repo ?? inMemoryStepsRepository();
  const run = jest.fn((write: () => Promise<void>) => void write());
  return { health, repo, run, steps: stepsUseCases({ health, repo, device: phone, clock, timezone: 'Europe/Paris' }) };
}

describe('outcomeText', () => {
  test('says what a sync read, in French', () => {
    expect(outcomeText({ kind: 'synced', steps: 6240, source: 'fitbit', at: new Date('2026-11-03T13:32:00Z') }, 'Europe/Paris')).toBe(`${(6240).toLocaleString('fr-FR')} pas lus à 14:32.`);
    expect(outcomeText({ kind: 'not-writer' }, 'Europe/Paris')).toBe('Un autre téléphone envoie les pas.');
    expect(outcomeText(null, 'Europe/Paris')).toBeUndefined();
  });

  test('says why the steps cannot be read, and nothing when they can', () => {
    expect(outcomeProblem({ kind: 'no-permission' })).toBe('Autorise la lecture des pas dans Réglages › Pas.');
    expect(outcomeProblem({ kind: 'unavailable' })).toBe('Health Connect n’est pas disponible sur ce téléphone.');
    expect(outcomeProblem({ kind: 'update-needed' })).toBe('Mets à jour Health Connect pour lire les pas.');
    expect(outcomeProblem({ kind: 'failed', error: 'boom' })).toBe('La lecture des pas a échoué : boom');
    expect(outcomeProblem({ kind: 'not-writer' })).toBeUndefined();
    expect(outcomeProblem({ kind: 'synced', steps: 1, source: 'phone', at: new Date() })).toBeUndefined();
  });
});

describe('useStepsSync', () => {
  test('the first phone is noted as the writer and reads the steps when the app opens', async () => {
    const { repo, run, steps } = setup();
    const { result } = await renderHook(() => useStepsSync(steps, run));
    expect(result.current.isWriter).toBe(true);
    expect(result.current.outcome).toMatchObject({ kind: 'synced', steps: 4200 });
    expect(repo.days.get('2026-11-03')).toMatchObject({ steps: 4200, source: 'fitbit' });
  });

  test('a phone that is not the writer reads nothing', async () => {
    const repo = inMemoryStepsRepository({ devices: [{ id: 'phone-b', name: 'Galaxy', stepsWriter: true }] });
    const { health, run, steps } = setup({ repo });
    const { result } = await renderHook(() => useStepsSync(steps, run));
    expect(result.current.isWriter).toBe(false);
    expect(health.reads).toEqual([]);
    await act(async () => result.current.sync());
    expect(result.current.outcome).toEqual({ kind: 'not-writer' });
  });

  test('waits for a snapshot that knows the devices before it decides who writes', async () => {
    const repo = inMemoryStepsRepository({ known: false });
    const { run, steps } = setup({ repo });
    await renderHook(() => useStepsSync(steps, run));
    expect(repo.devices).toEqual([]); // nothing is known of the account yet: this phone does not take the role
  });

  test('reads again when the app comes back to the foreground', async () => {
    let listener: (state: string) => void = () => {};
    jest.spyOn(AppState, 'addEventListener').mockImplementation(((_: string, l: (state: string) => void) => ((listener = l), { remove: () => {} })) as never);
    const { health, run, steps } = setup();
    await renderHook(() => useStepsSync(steps, run));
    const reads = health.reads.length;
    health.state.days['2026-11-03'] = { steps: 5000, origins: [FITBIT_PACKAGE] };
    await act(async () => listener('active'));
    expect(health.reads.length).toBeGreaterThan(reads);
  });

  test('says when the permission is missing', async () => {
    const { run, steps } = setup({ health: inMemoryHealthSource({ granted: false }) });
    const { result } = await renderHook(() => useStepsSync(steps, run));
    expect(result.current.outcome).toEqual({ kind: 'no-permission' });
  });
});

describe('StepsExtras', () => {
  test('syncs and opens the settings, and says what the last sync did', async () => {
    const onSync = jest.fn();
    const onOpenSettings = jest.fn();
    await draw(<StepsExtras outcome={{ kind: 'no-permission' }} timezone="Europe/Paris" onSync={onSync} onOpenSettings={onOpenSettings} />);
    expect(screen.getByText('Autorise la lecture des pas dans Réglages › Pas.').props.accessibilityLiveRegion).toBe('polite');
    await fireEvent.press(screen.getByText('Synchroniser'));
    await fireEvent.press(screen.getByText('Réglages des pas'));
    expect(onSync).toHaveBeenCalled();
    expect(onOpenSettings).toHaveBeenCalled();
  });
});

describe('StepsSettingsScreen', () => {
  async function open(options: Parameters<typeof setup>[0] = {}) {
    const ctx = setup(options);
    const hook = await renderHook(() => useStepsSync(ctx.steps, ctx.run));
    const view = () => <StepsSettingsScreen steps={ctx.steps} sync={hook.result.current} timezone="Europe/Paris" />;
    const { rerender } = await draw(view());
    return { ...ctx, hook, rerender: () => rerender(<PaperProvider theme={theme}>{view()}</PaperProvider>) };
  }

  test('says the permission is granted and the Fitbit detected, with its last data', async () => {
    await open({ health: inMemoryHealthSource({ sources: { '2026-11-03': [{ origin: FITBIT_PACKAGE, lastDataAt: new Date('2026-11-03T09:45:00Z') }] } }) });
    expect(await screen.findByText('Accordée')).toBeTruthy();
    expect(await screen.findByText('Détecté, dernière donnée à 10:45')).toBeTruthy();
    expect(screen.getAllByText('Fitbit').length).toBeGreaterThan(0);
  });

  test('says the phone counts the steps when no Fitbit wrote any', async () => {
    await open({ health: inMemoryHealthSource({ sources: { '2026-11-03': [{ origin: 'com.google.android.apps.fitness' }] } }) });
    expect(await screen.findByText('Pas détecté : le téléphone compte les pas')).toBeTruthy();
    expect(screen.getByText('Google Fit')).toBeTruthy();
  });

  test('asks for the permission, then reads', async () => {
    const { health } = await open({ health: inMemoryHealthSource({ granted: false }) });
    await fireEvent.press(await screen.findByText('Autoriser la lecture des pas'));
    expect(health.state.granted).toBe(true);
    expect(await screen.findByText('Accordée')).toBeTruthy();
  });

  test('says when Health Connect is absent', async () => {
    await open({ health: inMemoryHealthSource({ status: 'unavailable' }) });
    expect(await screen.findByText('Health Connect n’est pas disponible sur ce téléphone.')).toBeTruthy();
  });

  test('says when Health Connect is old', async () => {
    await open({ health: inMemoryHealthSource({ status: 'update-needed' }) });
    expect(await screen.findByText('Health Connect doit être mis à jour pour lire les pas.')).toBeTruthy();
  });

  test('opens Health Connect, where the priority is chosen', async () => {
    const { health } = await open();
    await fireEvent.press(await screen.findByText('Ouvrir Health Connect'));
    expect(health.settingsOpened).toBe(1);
  });

  test('another phone writes the steps: this one can take the role, and the other stops', async () => {
    const repo = inMemoryStepsRepository({ devices: [{ id: 'phone-b', name: 'Galaxy', stepsWriter: true }] });
    const { rerender } = await open({ repo });
    expect(await screen.findByText('Aujourd’hui : Galaxy')).toBeTruthy();
    await fireEvent(screen.getByLabelText('Ce téléphone envoie les pas'), 'valueChange', true);
    expect(repo.devices.map((d) => [d.id, d.stepsWriter]).sort()).toEqual([['phone-a', true], ['phone-b', false]]);
    await rerender();
  });

  test('syncs now and says what it read', async () => {
    const { hook } = await open();
    await fireEvent.press(await screen.findByText('Synchroniser maintenant'));
    expect(hook.result.current.outcome).toMatchObject({ kind: 'synced' });
  });
});
