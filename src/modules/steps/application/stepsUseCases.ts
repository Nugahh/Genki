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

/** The days a sync reads: the last week (a day the app was not opened on still gets its total), or a month the first time on a phone. */
const RECENT_DAYS = 7;
const FIRST_SYNC_DAYS = 30;

export function stepsUseCases(deps: { health: HealthDataSource; repo: StepsRepository; device: { id: string; name: string }; clock: Clock; timezone: string }) {
  const { health, repo, device, clock, timezone } = deps;
  // The total last handed to the server for each day by this session: a past day whose total has not changed is not written again.
  const written = new Map<string, number>();

  return {
    device,
    observeDevices: repo.observeDevices,

    /**
     * Reads the steps of the last days and plans the writes of the ones that changed; today's is always written, so that the time of
     * the last read is true. Only the phone that writes the steps reads them. Nothing is written here: `save` does it, and runs again
     * from scratch on a retry (a failed save forgets what it had written, so the next sync sends it again).
     */
    async sync(input: { isWriter: boolean; firstSync?: boolean }): Promise<{ outcome: SyncOutcome; save: () => Promise<void> }> {
      const nothing = async () => {};
      try {
        if (!input.isWriter) {
          written.clear(); // if the role comes back, everything is sent again
          return { outcome: { kind: 'not-writer' }, save: nothing };
        }
        const status = await health.status();
        if (status !== 'ready') return { outcome: { kind: status }, save: nothing };
        if (!(await health.hasPermission())) return { outcome: { kind: 'no-permission' }, save: nothing };

        const now = clock.now();
        const today = dayKey(now, timezone);
        const count = input.firstSync ? FIRST_SYNC_DAYS : RECENT_DAYS;
        const days = Array.from({ length: count }, (_, i) => addDays(today, i - count + 1));

        // Everything is read before anything is planned: a read that fails leaves no write behind.
        const reads: { day: string; steps: number; source: StoredSource }[] = [];
        for (const day of days) {
          const { steps, origins } = await health.daySteps(day, timezone);
          reads.push({ day, steps, source: storedSource(origins) });
        }

        const plan = reads.filter((r) => {
          // A past day at 0 is a phone whose Health Connect has no history of it: it must not wipe a total another phone wrote.
          if (r.day !== today && r.steps === 0) return false;
          return r.day === today || stepsChanged(written.get(r.day), r.steps);
        });
        for (const r of plan) written.set(r.day, r.steps);
        const save = async () => {
          try {
            await Promise.all([...plan.map((r) => repo.saveDay(r.day, { steps: r.steps, source: r.source, syncedAt: now })), repo.touchDevice(device.id, device.name, now)]);
          } catch (error) {
            for (const r of plan) written.delete(r.day);
            throw error;
          }
        };
        const latest = reads[reads.length - 1];
        return { outcome: { kind: 'synced', steps: latest.steps, source: latest.source, at: now }, save };
      } catch (error) {
        return { outcome: { kind: 'failed', error: error instanceof Error ? error.message : 'La lecture des pas a échoué.' }, save: nothing };
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
    /** The apps that wrote steps since yesterday, with the time of their last data. */
    sources(): Promise<StepsSource[]> {
      return health.recentSources(dayKey(clock.now(), timezone), timezone);
    },
  };
}

export type StepsUseCases = ReturnType<typeof stepsUseCases>;
