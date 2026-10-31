import { dayKey, type Clock } from '@/shared/clock';
import type { WaterEntry, WaterRepository } from './ports';

export function waterUseCases(repo: WaterRepository, clock: Clock, timezone: string) {
  return {
    /** The glass is in at once: `entry` is what it takes to take it back, `saved` settles once the server has it. */
    addWater(ml: number) {
      const now = clock.now();
      const glass = { day: dayKey(now, timezone), ml, createdAt: now };
      const { id, saved } = repo.add(glass);
      return { entry: { id, ...glass }, saved };
    },
    removeWater: async (entry: WaterEntry) => repo.remove(entry),
    /** The day's glasses, newest first. */
    observeDay(day: string, onNext: (entries: WaterEntry[]) => void, onError: (error: Error) => void) {
      return repo.observeDay(
        day,
        (entries) => onNext([...entries].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())),
        onError,
      );
    },
  };
}

export type Hydration = ReturnType<typeof waterUseCases>;
