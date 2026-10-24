import { importDatabaseFromAssetAsync, openDatabaseAsync } from 'expo-sqlite';
import type { SqlReader } from '@/modules/nutrition/adapters/ciqualCatalog';

// Bump the version in the file name when assets/ciqual.db is rebuilt: the app then installs the new copy.
const DATABASE = 'ciqual-2025-11-03.db';

export async function openCiqual(): Promise<SqlReader> {
  // <SQLiteProvider assetSource> without the component: the copy happens only while the file is not in the app's storage yet.
  // shortcut: the copy is not atomic, so an interrupted first copy leaves a broken file (clear the app data to recover); harden it if that ever happens.
  await importDatabaseFromAssetAsync(DATABASE, { assetId: require('../../assets/ciqual.db') });
  return openDatabaseAsync(DATABASE);
}
