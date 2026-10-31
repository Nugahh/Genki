import { collection, doc, getDocFromServer, getDocsFromServer, query, serverTimestamp, setDoc, Timestamp, where, writeBatch, type Firestore } from '@react-native-firebase/firestore';
import type { DataStore, RestoreResult } from '../application/ports';
import { chunk, COLLECTIONS, TIMESTAMP_KEY, isTimestampMarker, type CollectionName, type RawDoc, type RestoreWrite } from '../domain/backup';
import type { Totals } from '../domain/totals';

// Firestore allows 500 writes to a batch.
const BATCH = 400;

/** A stored value in the JSON form of a backup: a time becomes `{ "__timestamp": "<ISO date>" }`. */
function toJson(value: unknown): unknown {
  if (value instanceof Timestamp) return { [TIMESTAMP_KEY]: value.toDate().toISOString() };
  if (Array.isArray(value)) return value.map(toJson);
  if (typeof value === 'object' && value !== null) return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, toJson(v)]));
  return value;
}

/** The way back: a marker becomes a time. */
function fromJson(value: unknown): unknown {
  if (isTimestampMarker(value)) return Timestamp.fromDate(new Date(value.__timestamp));
  if (Array.isArray(value)) return value.map(fromJson);
  if (typeof value === 'object' && value !== null) return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, fromJson(v)]));
  return value;
}

const num = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? value : undefined);

/** Reads and writes the whole of `users/{uid}`: the backup, the restore, and the rebuilding of the totals of the days. */
export function firestoreDataStore(db: Firestore, uid: string): DataStore {
  const profile = doc(db, 'users', uid);
  const col = (name: CollectionName) => collection(db, 'users', uid, name);

  return {
    // Read from the server, never the cache: offline a read would answer with the few days that were opened, and a backup or a
    // recount made from them would be silently incomplete. Offline, it fails instead, and the screen says so.
    async readAll() {
      const snapshot = await getDocFromServer(profile);
      const collections: Partial<Record<CollectionName, RawDoc[]>> = {};
      for (const name of COLLECTIONS) {
        const docs = await getDocsFromServer(col(name));
        collections[name] = docs.docs.map((d) => ({ id: d.id, data: toJson(d.data()) as Record<string, unknown> }));
      }
      return { profile: (toJson(snapshot.data() ?? {}) as Record<string, unknown>), collections };
    },

    async restore(stored, writes: RestoreWrite[]): Promise<RestoreResult> {
      const result: RestoreResult = { written: 0, failed: 0 };
      const fail = (count: number, error: unknown) => {
        result.failed += count;
        result.firstError ??= error instanceof Error ? error.message : String(error);
      };
      try {
        await setDoc(profile, fromJson(stored) as Record<string, unknown>, { merge: true });
        result.written += 1;
      } catch (error) {
        fail(1, error); // the profile is a document too
      }
      // A batch never mixes collections, nor a creation with an update: a document the rules refuse then costs its own collection only,
      // and the update of a milestone (the date it was reached) finds the milestone already created.
      const groups = (['set', 'update'] as const).flatMap((mode) => COLLECTIONS.flatMap((name) => chunk(writes.filter((w) => w.mode === mode && w.collection === name), BATCH)));
      for (const part of groups) {
        try {
          const batch = writeBatch(db);
          for (const w of part) {
            const ref = doc(col(w.collection), w.id);
            const data = fromJson(w.data) as Record<string, unknown>;
            if (w.mode === 'update') batch.update(ref, data);
            else batch.set(ref, data);
          }
          await batch.commit();
          // The date a milestone was reached is part of the milestone, not a document of its own.
          result.written += part.filter((w) => w.mode === 'set').length;
        } catch (error) {
          fail(part.filter((w) => w.mode === 'set').length || part.length, error);
        }
      }
      return result;
    },

    async readTotalsInput() {
      const live = (name: 'waterEntries' | 'foodEntries') => getDocsFromServer(query(col(name), where('deletedAt', '==', null)));
      const [water, food, days] = await Promise.all([live('waterEntries'), live('foodEntries'), getDocsFromServer(col('days'))]);
      return {
        water: water.docs.map((d) => ({ day: d.data().day as string, ml: d.data().ml as number })),
        food: food.docs.map((d) => {
          const m = d.data().macros;
          return { day: d.data().day as string, kcal: m.kcal, protein: m.protein, carbs: m.carbs, fat: m.fat };
        }),
        days: new Map(days.docs.map((d) => [d.id, { waterMl: num(d.data().waterMl), kcal: num(d.data().kcal), proteinG: num(d.data().proteinG), carbsG: num(d.data().carbsG), fatG: num(d.data().fatG) }])),
      };
    },

    async writeTotals(totals: Map<string, Totals>) {
      for (const part of chunk([...totals], BATCH)) {
        const batch = writeBatch(db);
        // A merge: the weight and the waist of the day are not touched.
        for (const [day, t] of part) batch.set(doc(col('days'), day), { ...t, updatedAt: serverTimestamp() }, { merge: true });
        await batch.commit();
      }
    },
  };
}
