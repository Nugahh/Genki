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
  test('writes the days that have steps, with the Fitbit as their source, and says what today holds', async () => {
    const { repo, steps } = setup();
    const { outcome, save } = await steps.sync({ isWriter: true });
    await save();
    expect(outcome).toEqual({ kind: 'synced', steps: 4200, source: 'fitbit', at: new Date('2026-11-03T10:00:00Z') });
    expect(repo.days.get('2026-11-02')).toMatchObject({ steps: 9000, source: 'fitbit' });
    expect(repo.days.get('2026-11-03')).toMatchObject({ steps: 4200, source: 'fitbit' });
    expect(repo.devices[0]).toMatchObject({ id: 'phone-a', lastStepsSyncAt: new Date('2026-11-03T10:00:00Z') });
  });

  test('the source is the phone when no Fitbit wrote the steps', async () => {
    const { steps } = setup(inMemoryHealthSource({ days: { '2026-11-03': { steps: 3000, origins: ['com.google.android.apps.fitness'] } } }));
    expect((await steps.sync({ isWriter: true })).outcome).toMatchObject({ steps: 3000, source: 'phone' });
  });

  test('writes a past day again only when its total changed, and today at every sync (the time of the read is then true)', async () => {
    const { health, repo, steps } = setup();
    await (await steps.sync({ isWriter: true })).save();
    repo.days.clear();
    await (await steps.sync({ isWriter: true })).save();
    expect([...repo.days.keys()]).toEqual(['2026-11-03']); // yesterday's total is the same
    repo.days.clear();
    health.state.days['2026-11-02'] = { steps: 9500, origins: [FITBIT_PACKAGE] }; // it came in late
    await (await steps.sync({ isWriter: true })).save();
    expect([...repo.days.keys()].sort()).toEqual(['2026-11-02', '2026-11-03']);
    expect(repo.days.get('2026-11-02')?.steps).toBe(9500);
  });

  test('reads the last week, so that a day the app was not opened on still gets its total', async () => {
    const { health, repo, steps } = setup(inMemoryHealthSource({ days: { '2026-10-28': { steps: 7000, origins: [] }, '2026-11-03': { steps: 100, origins: [] } } }));
    await (await steps.sync({ isWriter: true })).save();
    expect(health.reads).toEqual(['2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02', '2026-11-03']);
    expect(repo.days.get('2026-10-28')?.steps).toBe(7000);
  });

  test('the first time on a phone goes back a month', async () => {
    const { health, steps } = setup();
    await steps.sync({ isWriter: true, firstSync: true });
    expect(health.reads).toHaveLength(30);
    expect(health.reads[0]).toBe('2026-10-05');
  });

  test('never writes a 0 over a past day: a phone with no history there would wipe the total another phone wrote', async () => {
    const { repo, steps } = setup(inMemoryHealthSource({ days: { '2026-11-02': { steps: 0, origins: [] }, '2026-11-03': { steps: 0, origins: [] } } }));
    await (await steps.sync({ isWriter: true })).save();
    expect([...repo.days.keys()]).toEqual(['2026-11-03']); // today at 0 is a true reading
  });

  test('does not wait for the server: the outcome is there while the writes are still out', async () => {
    const { repo, steps } = setup();
    repo.saveDay = () => new Promise(() => {});
    const { outcome } = await steps.sync({ isWriter: true });
    expect(outcome.kind).toBe('synced');
  });

  test('a save the server refused runs again from scratch on a retry, and sends the days again at the next sync', async () => {
    const { repo, steps } = setup();
    const real = repo.saveDay.bind(repo);
    repo.saveDay = async () => {
      throw new Error('permission-denied');
    };
    const first = await steps.sync({ isWriter: true });
    await expect(first.save()).rejects.toThrow('permission-denied');
    repo.saveDay = real; // the rules are deployed
    await first.save(); // the retry of « Réessayer » is the same closure
    expect(repo.days.get('2026-11-03')?.steps).toBe(4200);

    repo.days.clear();
    repo.saveDay = async () => {
      throw new Error('permission-denied');
    };
    const second = await steps.sync({ isWriter: true });
    await expect(second.save()).rejects.toThrow();
    repo.saveDay = real;
    await (await steps.sync({ isWriter: true })).save(); // yesterday is sent again: it was not kept as written
    expect([...repo.days.keys()].sort()).toEqual(['2026-11-02', '2026-11-03']);
  });

  test('a read that fails leaves no write behind', async () => {
    const { health, repo, steps } = setup();
    const real = health.daySteps.bind(health);
    health.daySteps = async (day: string) => {
      if (day === '2026-11-03') throw new Error('SecurityException');
      return real(day);
    };
    const { outcome, save } = await steps.sync({ isWriter: true });
    await save();
    expect(outcome).toEqual({ kind: 'failed', error: 'SecurityException' });
    expect(repo.days.size).toBe(0);
  });

  test.each([
    ['unavailable', { status: 'unavailable' as const }],
    ['update-needed', { status: 'update-needed' as const }],
    ['no-permission', { granted: false }],
  ])('says %s and writes nothing', async (kind, options) => {
    const { repo, steps } = setup(inMemoryHealthSource({ ...options, days: { '2026-11-03': { steps: 100, origins: [] } } }));
    const { outcome, save } = await steps.sync({ isWriter: true });
    await save();
    expect(outcome.kind).toBe(kind);
    expect(repo.days.size).toBe(0);
  });

  test('a phone that is not the writer does not read or write, whatever the state of Health Connect on it', async () => {
    const { health, repo, steps } = setup(inMemoryHealthSource({ status: 'unavailable' }));
    expect((await steps.sync({ isWriter: false })).outcome).toEqual({ kind: 'not-writer' });
    expect(health.reads).toEqual([]);
    expect(repo.days.size).toBe(0);
  });

  test('a phone that gets the role back sends everything again', async () => {
    const { repo, steps } = setup();
    await (await steps.sync({ isWriter: true })).save();
    await steps.sync({ isWriter: false });
    repo.days.clear();
    await (await steps.sync({ isWriter: true })).save();
    expect([...repo.days.keys()].sort()).toEqual(['2026-11-02', '2026-11-03']);
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
