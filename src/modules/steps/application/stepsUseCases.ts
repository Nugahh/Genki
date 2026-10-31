import { addDays, dayKey, type Clock } from '@/shared/clock';
import { stepsChanged, storedSource, type StepsSource, type StoredSource } from '../domain/steps';
import type { Device, HealthDataSource, StepsRepository } from './ports';

export type SyncOutcome =
  | { kind: 'synced'; steps: number; source: StoredSource; at: Date }
  /** This phone is not the one that writes the steps. */
  | { kind: 'not-writer' }
  | { kind: 'no-permission' }
  | { kind: 'unavailable' }
  | { kind: 'update-needed' }
  | { kind: 'failed'; error: string };

export function stepsUseCases(deps: { health: HealthDataSource; repo: StepsRepository; device: { id: string; name: string }; clock: Clock; timezone: string }) {
  const { health, repo, device, clock, timezone } = deps;
  // The total last written for each day by this session: a total that has not changed is not written again.
  const written = new Map<string, number>();

  return {
    device,
    observeDevices: repo.observeDevices,

    /**
     * Reads yesterday's steps and today's (the tracker syncs every 15 minutes or so, so yesterday's can come late) and writes the ones
     * that changed. Only the phone that writes the steps does. The writes are in at once; `saved` settles once the server has them.
     */
    async sync(input: { isWriter: boolean }): Promise<{ outcome: SyncOutcome; saved: Promise<void> }> {
      const nothing = Promise.resolve();
      try {
        const status = await health.status();
        if (status !== 'ready') return { outcome: { kind: status }, saved: nothing };
        if (!input.isWriter) return { outcome: { kind: 'not-writer' }, saved: nothing };
        if (!(await health.hasPermission())) return { outcome: { kind: 'no-permission' }, saved: nothing };

        const now = clock.now();
        const today = dayKey(now, timezone);
        const saves: Promise<void>[] = [];
        let latest: { steps: number; source: StoredSource } = { steps: 0, source: 'phone' };
        for (const day of [addDays(today, -1), today]) {
          const { steps, origins } = await health.daySteps(day, timezone);
          const source = storedSource(origins);
          if (day === today) latest = { steps, source };
          if (stepsChanged(written.get(day), steps)) {
            written.set(day, steps);
            saves.push(repo.saveDay(day, { steps, source, syncedAt: now }));
          }
        }
        saves.push(repo.touchDevice(device.id, device.name, now));
        return { outcome: { kind: 'synced', ...latest, at: now }, saved: Promise.all(saves).then(() => undefined) };
      } catch (error) {
        return { outcome: { kind: 'failed', error: error instanceof Error ? error.message : 'La lecture des pas a échoué.' }, saved: nothing };
      }
    },

    /** Notes this phone among the devices; the first one to come becomes the writer. Returns whether this phone writes the steps. */
    async registerThisDevice(devices: Device[]): Promise<boolean> {
      const me = devices.find((d) => d.id === device.id);
      if (!devices.some((d) => d.stepsWriter)) {
        await repo.setWriter(device.id, device.name, []);
        return true;
      }
      if (!me) await repo.touchDevice(device.id, device.name);
      return me?.stepsWriter ?? false;
    },
    /** Makes this phone the one that writes the steps; the others stop. */
    makeWriter: (devices: Device[]) =>
      repo.setWriter(
        device.id,
        device.name,
        devices.filter((d) => d.id !== device.id && d.stepsWriter).map((d) => d.id),
      ),

    status: () => health.status(),
    hasPermission: () => health.hasPermission(),
    requestPermission: () => health.requestPermission(),
    openHealthSettings: () => health.openSettings(),
    /** The apps that wrote steps today, with the time of their last data. */
    sources(): Promise<StepsSource[]> {
      return health.recentSources(dayKey(clock.now(), timezone), timezone);
    },
  };
}

export type StepsUseCases = ReturnType<typeof stepsUseCases>;
