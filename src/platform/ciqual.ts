import { importDatabaseFromAssetAsync, openDatabaseAsync } from 'expo-sqlite';
import type { SqlReader } from '@/modules/nutrition/adapters/ciqualCatalog';

// Bump the version in the file name when assets/ciqual.db is rebuilt: the app then installs the new copy.
const DATABASE = 'ciqual-2025-11-03.db';

export async function openCiqual(): Promise<SqlReader> {
  // <SQLiteProvider assetSource> without the component: the copy happens only while the file is not in the app's storage yet.
  // importDatabaseFromAssetAsync is @hidden ("testing only") in SDK 58 (build/hooks.d.ts) but is exactly what the provider calls
  // (build/hooks.js): if a later SDK breaks the typecheck here, that is why, and <SQLiteProvider assetSource> is the way out.
  // shortcut: the copy is not atomic, so an interrupted first copy leaves a broken file (clear the app data to recover); harden it if that ever happens.
  await importDatabaseFromAssetAsync(DATABASE, { assetId: require('../../assets/ciqual.db') });
  const db = await openDatabaseAsync(DATABASE);
  // expo-sqlite 58 has no read-only open option: the database itself refuses writes.
  await db.execAsync('PRAGMA query_only = ON');
  return db;
}
