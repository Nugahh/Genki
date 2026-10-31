import { dayKey, type Clock } from '@/shared/clock';
import { exportFile, parseBackup, restoreWrites } from '../domain/backup';
import { daysToCorrect, totalsFromEntries } from '../domain/totals';
import type { DataStore, RestoreResult } from './ports';

export function dataUseCases(deps: { store: DataStore; clock: Clock; timezone: string }) {
  const { store, clock, timezone } = deps;

  return {
    /** The whole account as a JSON file: its name (with today's date) and its text. */
    async exportBackup() {
      const now = clock.now();
      const { profile, collections } = await store.readAll();
      return { name: `genki-${dayKey(now, timezone)}.json`, text: JSON.stringify(exportFile({ profile, collections, now }), null, 2) };
    },

    /** What a backup would write, checked, before anything is written: the documents (one more for the profile; a deleted one is not written back). */
    previewBackup(text: string) {
      const parsed = parseBackup(text);
      if (!parsed.ok) throw new Error(parsed.error);
      return { documents: 1 + restoreWrites(parsed.backup).filter((w) => w.mode === 'set').length };
    },

    /** Restores a backup into the account (it is made for an empty one); reports what was written and what the rules refused. */
    async importBackup(text: string): Promise<RestoreResult> {
      const parsed = parseBackup(text);
      if (!parsed.ok) throw new Error(parsed.error);
      return store.restore(parsed.backup.profile, restoreWrites(parsed.backup));
    },

    /** Rebuilds the totals of each day from its entries (spec §8); returns the days looked at and the ones that were wrong. */
    async recomputeTotals() {
      const input = await store.readTotalsInput();
      const right = totalsFromEntries(input);
      const wrong = daysToCorrect(right, input.days);
      if (wrong.size > 0) await store.writeTotals(wrong);
      return { days: right.size, corrected: wrong.size };
    },
  };
}

export type DataUseCases = ReturnType<typeof dataUseCases>;
