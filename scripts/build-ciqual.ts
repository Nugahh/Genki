// Builds the read-only food database shipped with the app from the Anses Ciqual XML files:
//   npm run build:ciqual -- <dir with alim.xml and compo.xml> <version, e.g. 2025-11-03> [output]
import { readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { convertCiqual } from './ciqual/convert.ts';

const [dir, version, out = 'assets/ciqual.db'] = process.argv.slice(2);
if (!dir || !version) throw new Error('usage: build-ciqual <dir with alim.xml and compo.xml> <version> [output]');

const read = (file: string) => readFileSync(join(dir, file), 'utf8');
const foods = convertCiqual(read('alim.xml'), read('compo.xml'));
if (foods.length < 3000) throw new Error(`unexpected Ciqual format: only ${foods.length} foods converted`);

rmSync(out, { force: true });
const db = new DatabaseSync(out);
db.exec(`
  CREATE TABLE foods (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, search TEXT NOT NULL,
    state TEXT NOT NULL CHECK (state IN ('raw', 'cooked', 'other')),
    kcal REAL NOT NULL, protein REAL NOT NULL, carbs REAL NOT NULL, fat REAL NOT NULL
  );
  CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
  BEGIN;
`);
const insert = db.prepare('INSERT INTO foods VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
for (const f of foods) insert.run(f.id, f.name, f.search, f.state, f.kcal, f.protein, f.carbs, f.fat);
const meta = db.prepare('INSERT INTO meta VALUES (?, ?)');
meta.run('source', 'Anses, Table de composition nutritionnelle des aliments Ciqual 2025 (doi:10.57745/RDMHWY)');
meta.run('version', version);
meta.run('licence', 'Licence Ouverte Etalab 2.0');
meta.run('citation', `Anses. 2025. Table de composition nutritionnelle des aliments Ciqual (version ${version}).`);
db.exec('COMMIT; VACUUM;');
db.close();
console.log(`${out}: ${foods.length} foods`);
