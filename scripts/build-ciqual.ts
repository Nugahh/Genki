// Builds the read-only food database shipped with the app from the Anses Ciqual XML files:
//   npm run build:ciqual -- <dir with alim.xml and compo.xml> <version, e.g. 2025-11-03-r2> [output]
// The version is the file name of the installed copy: the table of Ciqual (its date) then, after a dash, the revision of this build.
import { readFileSync, renameSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { convertCiqual } from './ciqual/convert.ts';

const [dir, version, out = 'assets/ciqual.db'] = process.argv.slice(2);
if (!dir || !version) {
  console.error('usage: build-ciqual <dir with alim.xml and compo.xml> <version> [output]');
  process.exit(1);
}

const read = (file: string) => readFileSync(join(dir, file), 'utf8');
const foods = convertCiqual(read('alim.xml'), read('compo.xml'));
if (foods.length < 3000) throw new Error(`unexpected Ciqual format: only ${foods.length} foods converted`);

// Built beside the target and renamed over it: a failure never leaves a broken database behind.
const tmp = `${out}.tmp`;
rmSync(tmp, { force: true });
const db = new DatabaseSync(tmp);
db.exec(`
  CREATE TABLE foods (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, search TEXT NOT NULL,
    state TEXT NOT NULL CHECK (state IN ('raw', 'cooked', 'other')),
    kcal REAL NOT NULL, protein REAL NOT NULL, carbs REAL NOT NULL, fat REAL NOT NULL,
    nutrients TEXT -- JSON of the nutrients per 100 g, NULL when Ciqual determines none
  );
  CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
  BEGIN;
`);
const insert = db.prepare('INSERT INTO foods VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
for (const f of foods) insert.run(f.id, f.name, f.search, f.state, f.kcal, f.protein, f.carbs, f.fat, f.nutrients ? JSON.stringify(f.nutrients) : null);
const meta = db.prepare('INSERT INTO meta VALUES (?, ?)');
meta.run('source', 'Anses, Table de composition nutritionnelle des aliments Ciqual 2025 (doi:10.57745/RDMHWY)');
meta.run('version', version);
meta.run('licence', 'Licence Ouverte Etalab 2.0');
meta.run('citation', `Anses. 2025. Table de composition nutritionnelle des aliments Ciqual (version ${version.slice(0, 10)}).`);
db.exec('COMMIT; VACUUM;');
db.close();
renameSync(tmp, out);
console.log(`${out}: ${foods.length} foods`);
