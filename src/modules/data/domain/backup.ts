export const BACKUP_VERSION = 1;

/** The collections of `users/{uid}` a backup holds (spec §4). */
export const COLLECTIONS = ['days', 'waterEntries', 'foodEntries', 'foods', 'favoriteMeals', 'plans', 'workoutLogs', 'milestones', 'cravings'] as const;
export type CollectionName = (typeof COLLECTIONS)[number];

/** A document in the JSON form of a backup: a time is `{ "__timestamp": "<ISO date>" }`. */
export type RawDoc = { id: string; data: Record<string, unknown> };

export type BackupFile = {
  version: typeof BACKUP_VERSION;
  exportedAt: string;
  /** The profile document `users/{uid}`. */
  profile: Record<string, unknown>;
  collections: Partial<Record<CollectionName, RawDoc[]>>;
};

export type ParsedBackup = { ok: true; backup: BackupFile } | { ok: false; error: string };

/** A write that restores a backup: a document created, or (for the date a milestone was reached) a field set on one just created. */
export type RestoreWrite = { collection: CollectionName; id: string; data: Record<string, unknown>; mode: 'set' | 'update' };

export const TIMESTAMP_KEY = '__timestamp';
export const isTimestampMarker = (value: unknown): value is { __timestamp: string } =>
  typeof value === 'object' && value !== null && Object.keys(value).length === 1 && TIMESTAMP_KEY in value;

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

/** The first problem with a time in the document, or null: every marker holds a real date. */
function badTimestamp(value: unknown): boolean {
  if (isTimestampMarker(value)) return typeof value.__timestamp !== 'string' || Number.isNaN(Date.parse(value.__timestamp));
  if (Array.isArray(value)) return value.some(badTimestamp);
  if (isObject(value)) return Object.values(value).some(badTimestamp);
  return false;
}

export function exportFile(input: { profile: Record<string, unknown>; collections: Partial<Record<CollectionName, RawDoc[]>>; now: Date }): BackupFile {
  return { version: BACKUP_VERSION, exportedAt: input.now.toISOString(), profile: input.profile, collections: input.collections };
}

/** Reads a backup, checking its shape: the version, the known collections, an id and data for each document, real dates. */
export function parseBackup(text: string): ParsedBackup {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: 'Ce fichier n’est pas une sauvegarde : ce n’est pas du JSON.' };
  }
  if (!isObject(raw) || raw.version !== BACKUP_VERSION) return { ok: false, error: 'Ce fichier n’est pas une sauvegarde de cette version.' };
  if (!isObject(raw.profile) || !isObject(raw.collections) || typeof raw.exportedAt !== 'string') return { ok: false, error: 'La sauvegarde est incomplète.' };
  if (badTimestamp(raw.profile)) return { ok: false, error: 'La sauvegarde contient une date qui n’en est pas une.' };

  for (const [name, docs] of Object.entries(raw.collections)) {
    if (!(COLLECTIONS as readonly string[]).includes(name)) return { ok: false, error: `La sauvegarde contient une collection inconnue : ${name}.` };
    if (!Array.isArray(docs)) return { ok: false, error: `La collection ${name} n’est pas une liste.` };
    for (const d of docs) {
      if (!isObject(d) || typeof d.id !== 'string' || d.id === '' || d.id.length > 128 || d.id.includes('/') || !isObject(d.data)) {
        return { ok: false, error: `Un document de ${name} n’a pas d’identifiant ou de contenu valide.` };
      }
      if (badTimestamp(d.data)) return { ok: false, error: `Un document de ${name} contient une date qui n’en est pas une.` };
    }
  }
  return { ok: true, backup: raw as unknown as BackupFile };
}

const SOFT_DELETED: CollectionName[] = ['waterEntries', 'foodEntries', 'foods', 'workoutLogs'];

/**
 * What to write to restore the backup, creations first. A document deleted in the app (soft delete) is not written back; the date
 * a milestone was reached cannot be set at creation (the rules say so), so it follows as an update once the milestone exists.
 */
export function restoreWrites(backup: BackupFile): RestoreWrite[] {
  const sets: RestoreWrite[] = [];
  const updates: RestoreWrite[] = [];
  for (const name of COLLECTIONS) {
    for (const { id, data } of backup.collections[name] ?? []) {
      if (SOFT_DELETED.includes(name) && data.deletedAt !== undefined && data.deletedAt !== null) continue;
      if (name === 'milestones' && data.achievedAt !== undefined) {
        const { achievedAt, ...rest } = data;
        sets.push({ collection: name, id, data: rest, mode: 'set' });
        updates.push({ collection: name, id, data: { achievedAt }, mode: 'update' });
      } else {
        sets.push({ collection: name, id, data, mode: 'set' });
      }
    }
  }
  return [...sets, ...updates];
}

export function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}
