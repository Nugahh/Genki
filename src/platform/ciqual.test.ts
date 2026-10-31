import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { normalizeSearch } from '@/modules/nutrition/domain/normalize';

// openCiqual needs the native module, so its source is read as text: the installed file name carries the database version.
test('the installed file name carries the version of assets/ciqual.db', () => {
  const db = new DatabaseSync('assets/ciqual.db', { readOnly: true });
  const { value } = db.prepare("SELECT value FROM meta WHERE key = 'version'").get() as { value: string };
  db.close();
  expect(readFileSync('src/platform/ciqual.ts', 'utf8')).toContain(`ciqual-${value}.db`);
});

// The search column keeps normalizeSearch(name) from the build: changing that function means rebuilding assets/ciqual.db (README).
test('the search column of assets/ciqual.db is normalizeSearch of the name, for every food', () => {
  const db = new DatabaseSync('assets/ciqual.db', { readOnly: true });
  const rows = db.prepare('SELECT name, search FROM foods').all() as { name: string; search: string }[];
  db.close();
  // The first three are enough to see what changed: a changed rule can stale thousands of rows.
  expect(rows.filter((row) => normalizeSearch(row.name) !== row.search).slice(0, 3)).toEqual([]);
});
