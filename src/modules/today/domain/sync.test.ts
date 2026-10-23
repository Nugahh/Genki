import { syncStatus, type SyncMeta, type SyncStatus } from './sync';

test.each<[SyncMeta, boolean, SyncStatus]>([
  [{ hasPendingWrites: false, fromCache: false }, false, 'synced'],
  [{ hasPendingWrites: true, fromCache: true }, false, 'pending'],
  [{ hasPendingWrites: true, fromCache: false }, false, 'pending'],
  [{ hasPendingWrites: false, fromCache: true }, false, 'offline'],
  [{ hasPendingWrites: false, fromCache: false }, true, 'error'],
])('%o with failed=%s is %s', (meta, failed, status) => {
  expect(syncStatus(meta, failed)).toBe(status);
});
