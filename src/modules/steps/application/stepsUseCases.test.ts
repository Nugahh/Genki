import { inMemoryHealthSource } from '../adapters/inMemoryHealthSource';
import { inMemoryStepsRepository } from '../adapters/inMemoryStepsRepository';
import { FITBIT_PACKAGE } from '../domain/steps';
import { stepsUseCases } from './stepsUseCases';

const clock = { now: () => new Date('2026-11-03T10:00:00Z') }; // Tuesday 3 November, 11:00 in Paris
const phone = { id: 'phone-a', name: 'Pixel' };

function setup(health = inMemoryHealthSource({ days: { '2026-11-02': { steps: 9000, origins: [FITBIT_PACKAGE] }, '2026-11-03': { steps: 4200, origins: [FITBIT_PACKAGE] } } }), repo = inMemoryStepsRepository()) {
  return { health, repo, steps: stepsUseCases({ health, repo, device: phone, clock, timezone: 'Europe/Paris' }) };
}

describe('sync', () => {
  test('writes yesterday and today, with the Fitbit as their source, and says what today holds', async () => {
    const { repo, steps } = setup();
    const { outcome, saved } = await steps.sync({ isWriter: true });
    await saved;
    expect(outcome).toEqual({ kind: 'synced', steps: 4200, source: 'fitbit', at: new Date('2026-11-03T10:00:00Z') });
    expect(repo.days.get('2026-11-02')).toMatchObject({ steps: 9000, source: 'fitbit' });
    expect(repo.days.get('2026-11-03')).toMatchObject({ steps: 4200, source: 'fitbit' });
    expect(repo.devices[0]).toMatchObject({ id: 'phone-a', lastStepsSyncAt: new Date('2026-11-03T10:00:00Z') });
  });

  test('the source is the phone when no Fitbit wrote the steps', async () => {
    const { steps } = setup(inMemoryHealthSource({ days: { '2026-11-03': { steps: 3000, origins: ['com.google.android.apps.fitness'] } } }));
    expect((await steps.sync({ isWriter: true })).outcome).toMatchObject({ steps: 3000, source: 'phone' });
  });

  test('writes only the totals that changed since the last sync', async () => {
    const { health, repo, steps } = setup();
    await (await steps.sync({ isWriter: true })).saved;
    repo.days.clear();
    health.state.days['2026-11-03'] = { steps: 4900, origins: [FITBIT_PACKAGE] };
    await (await steps.sync({ isWriter: true })).saved;
    expect([...repo.days.keys()]).toEqual(['2026-11-03']);
    expect(repo.days.get('2026-11-03')?.steps).toBe(4900);
  });

  test('does not wait for the server: the outcome is there while the writes are still out', async () => {
    const { repo, steps } = setup();
    repo.saveDay = () => new Promise(() => {});
    const { outcome } = await steps.sync({ isWriter: true });
    expect(outcome.kind).toBe('synced');
  });

  test.each([
    ['unavailable', { status: 'unavailable' as const }],
    ['update-needed', { status: 'update-needed' as const }],
    ['no-permission', { granted: false }],
  ])('says %s and writes nothing', async (kind, options) => {
    const { repo, steps } = setup(inMemoryHealthSource({ ...options, days: { '2026-11-03': { steps: 100, origins: [] } } }));
    const { outcome, saved } = await steps.sync({ isWriter: true });
    await saved;
    expect(outcome.kind).toBe(kind);
    expect(repo.days.size).toBe(0);
  });

  test('a phone that is not the writer does not read or write', async () => {
    const { health, repo, steps } = setup();
    expect((await steps.sync({ isWriter: false })).outcome).toEqual({ kind: 'not-writer' });
    expect(health.reads).toEqual([]);
    expect(repo.days.size).toBe(0);
  });

  test('says why the read failed, without throwing', async () => {
    const { health, steps } = setup();
    health.daySteps = async () => {
      throw new Error('SecurityException');
    };
    expect((await steps.sync({ isWriter: true })).outcome).toEqual({ kind: 'failed', error: 'SecurityException' });
  });
});

describe('the writer', () => {
  test('the first phone to come becomes the writer', async () => {
    const { repo, steps } = setup();
    expect(await steps.registerThisDevice([])).toBe(true);
    expect(repo.devices).toEqual([{ id: 'phone-a', name: 'Pixel', stepsWriter: true }]);
  });

  test('a second phone is noted and does not write', async () => {
    const other = { id: 'phone-b', name: 'Galaxy', stepsWriter: true };
    const { repo, steps } = setup(undefined, inMemoryStepsRepository({ devices: [other] }));
    expect(await steps.registerThisDevice(repo.devices)).toBe(false);
    expect(repo.devices.map((d) => [d.id, d.stepsWriter])).toEqual([['phone-b', true], ['phone-a', false]]);
  });

  test('a phone already known keeps its role', async () => {
    const mine = { id: 'phone-a', name: 'Pixel', stepsWriter: true };
    const { repo, steps } = setup(undefined, inMemoryStepsRepository({ devices: [mine] }));
    expect(await steps.registerThisDevice(repo.devices)).toBe(true);
    expect(repo.devices).toEqual([mine]);
  });

  test('making this phone the writer takes the role off the others, in one go', async () => {
    const devices = [{ id: 'phone-b', name: 'Galaxy', stepsWriter: true }, { id: 'phone-a', name: 'Pixel', stepsWriter: false }];
    const { repo, steps } = setup(undefined, inMemoryStepsRepository({ devices }));
    await steps.makeWriter(repo.devices);
    expect(repo.devices.map((d) => [d.id, d.stepsWriter])).toEqual([['phone-b', false], ['phone-a', true]]);
  });
});

test('asks for the permission and says the apps that wrote steps today', async () => {
  const { health, steps } = setup(inMemoryHealthSource({ granted: false, sources: { '2026-11-03': [{ origin: FITBIT_PACKAGE, lastDataAt: new Date('2026-11-03T09:45:00Z') }] } }));
  expect(await steps.hasPermission()).toBe(false);
  expect(await steps.requestPermission()).toBe(true);
  expect(await steps.sources()).toEqual([{ origin: FITBIT_PACKAGE, lastDataAt: new Date('2026-11-03T09:45:00Z') }]);
  steps.openHealthSettings();
  expect(health.settingsOpened).toBe(1);
});
