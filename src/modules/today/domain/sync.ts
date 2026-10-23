/** Firestore snapshot metadata, the source of the sync state (spec §6). */
export type SyncMeta = { hasPendingWrites: boolean; fromCache: boolean };

export type SyncStatus = 'synced' | 'pending' | 'offline' | 'error';

export function syncStatus(meta: SyncMeta, failed: boolean): SyncStatus {
  if (failed) return 'error';
  if (meta.hasPendingWrites) return 'pending';
  return meta.fromCache ? 'offline' : 'synced';
}
