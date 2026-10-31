import type { DataStore, RestoreResult } from '../application/ports';
import { COLLECTIONS, type CollectionName, type RawDoc, type RestoreWrite } from '../domain/backup';
import type { Totals, TotalsInput } from '../domain/totals';

/** DataStore kept in memory, for tests: documents are held in the JSON form of a backup. `refuse` lists ids the "rules" turn down. */
export function inMemoryDataStore(initial: { profile?: Record<string, unknown>; collections?: Partial<Record<CollectionName, RawDoc[]>> } = {}, refuse: string[] = []) {
  const store = {
    profile: { ...initial.profile } as Record<string, unknown>,
    docs: new Map<CollectionName, Map<string, Record<string, unknown>>>(COLLECTIONS.map((name) => [name, new Map((initial.collections?.[name] ?? []).map((d) => [d.id, d.data]))])),

    async readAll() {
      return {
        profile: store.profile,
        collections: Object.fromEntries(COLLECTIONS.map((name) => [name, [...store.docs.get(name)!].map(([id, data]) => ({ id, data }))])),
      };
    },
    async restore(profile: Record<string, unknown>, writes: RestoreWrite[]): Promise<RestoreResult> {
      store.profile = { ...store.profile, ...profile };
      let written = 0;
      let failed = 0;
      let firstError: string | undefined;
      for (const w of writes) {
        if (refuse.includes(w.id)) {
          failed++;
          firstError ??= `refused: ${w.id}`;
          continue;
        }
        const collection = store.docs.get(w.collection)!;
        collection.set(w.id, w.mode === 'update' ? { ...collection.get(w.id), ...w.data } : w.data);
        written++;
      }
      return { written, failed, firstError };
    },
    async readTotalsInput(): Promise<TotalsInput> {
      const live = (name: CollectionName) => [...store.docs.get(name)!.values()].filter((d) => d.deletedAt === null || d.deletedAt === undefined);
      return {
        water: live('waterEntries').map((d) => ({ day: d.day as string, ml: d.ml as number })),
        food: live('foodEntries').map((d) => {
          const m = d.macros as { kcal: number; protein: number; carbs: number; fat: number };
          return { day: d.day as string, kcal: m.kcal, protein: m.protein, carbs: m.carbs, fat: m.fat };
        }),
        days: new Map([...store.docs.get('days')!].map(([id, data]) => [id, data as Partial<Totals>])),
      };
    },
    async writeTotals(totals: Map<string, Totals>) {
      const days = store.docs.get('days')!;
      for (const [day, t] of totals) days.set(day, { ...days.get(day), ...t });
    },
  };
  return store satisfies DataStore & object;
}
