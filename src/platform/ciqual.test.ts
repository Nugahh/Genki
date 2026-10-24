import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

// openCiqual needs the native module, so its source is read as text: the installed file name carries the database version.
test('the installed file name carries the version of assets/ciqual.db', () => {
  const db = new DatabaseSync('assets/ciqual.db', { readOnly: true });
  const { value } = db.prepare("SELECT value FROM meta WHERE key = 'version'").get() as { value: string };
  db.close();
  expect(readFileSync('src/platform/ciqual.ts', 'utf8')).toContain(`ciqual-${value}.db`);
});
