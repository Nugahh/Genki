import { DatabaseSync } from 'node:sqlite';
import { normalizeSearch } from '../domain/normalize';
import { ciqualCatalog, type SqlReader } from './ciqualCatalog';

const readerOf = (database: DatabaseSync): SqlReader => ({
  getAllAsync: async (sql, params = []) => database.prepare(sql).all(...params) as never,
});

// The real embedded table, opened read-only through Node's SQLite.
const db = new DatabaseSync('assets/ciqual.db', { readOnly: true });
afterAll(() => db.close());
const reader = readerOf(db);
const catalog = ciqualCatalog(async () => reader);

const names = async (query: string, state?: 'raw' | 'cooked') => (await catalog.search(query, { state })).map((f) => f.name);

test('finds foods by name, ignoring accents, case and the œ ligature', async () => {
  expect(await names('RIZ blanc')).toContain('Riz blanc, cru');
  const oeuf = await names('œuf');
  expect(oeuf).toContain('Oeuf cru');
  expect(await names('oeuf')).toEqual(oeuf);
});

test('every result holds every term, and the first result of "riz" starts with riz', async () => {
  const results = await names('poulet filet');
  expect(results.length).toBeGreaterThan(0);
  expect(results.every((n) => /poulet/i.test(n) && /filet/i.test(n))).toBe(true);
  const riz = await names('riz');
  expect(riz[0].toLowerCase().startsWith('riz')).toBe(true);
});

test('the state filter keeps raw or cooked foods only', async () => {
  const cooked = await catalog.search('riz', { state: 'cooked' });
  expect(cooked.length).toBeGreaterThan(0);
  expect(cooked.every((f) => f.state === 'cooked')).toBe(true);
  const raw = await catalog.search('riz', { state: 'raw' });
  expect(raw.map((f) => f.name)).toContain('Riz blanc, cru');
});

test('a blank query finds nothing and the limit is honored', async () => {
  expect(await catalog.search('   ')).toEqual([]);
  expect(await catalog.search('a', { limit: 5 })).toHaveLength(5);
});

test('get returns a food with its per-100 g macros and a Ciqual reference', async () => {
  const rice = await catalog.get('9100');
  expect(rice).toMatchObject({ ref: { type: 'ciqual', id: '9100' }, name: 'Riz blanc, cru', state: 'raw', portions: [] });
  expect(rice!.per100g.kcal).toBeGreaterThan(300);
  expect(rice!.per100g.kcal).toBeLessThan(400);
  expect(rice!.per100g.protein).toBeGreaterThan(5);
  expect(await catalog.get('does-not-exist')).toBeUndefined();
});

test('opens the database once, on first use', async () => {
  const open = jest.fn(async () => reader);
  const lazy = ciqualCatalog(open);
  expect(open).not.toHaveBeenCalled();
  await lazy.search('riz');
  await lazy.get('9100');
  expect(open).toHaveBeenCalledTimes(1);
});

test('a failed open does not stick: the next call opens again', async () => {
  const open = jest.fn(async () => reader).mockRejectedValueOnce(new Error('storage not ready'));
  const flaky = ciqualCatalog(open);
  await expect(flaky.search('riz')).rejects.toThrow('storage not ready');
  expect((await flaky.search('riz')).map((f) => f.name)).toContain('Riz blanc, cru');
  expect(open).toHaveBeenCalledTimes(2);
});

test('ranks names starting with the first term, then words starting with it, then the rest, shorter first', async () => {
  const fixture = new DatabaseSync(':memory:');
  fixture.exec((db.prepare("SELECT sql FROM sqlite_master WHERE name = 'foods'").get() as { sql: string }).sql);
  const insert = fixture.prepare("INSERT INTO foods VALUES (?, ?, ?, 'other', 100, 0, 0, 0, NULL)");
  ['Riz soufflé', 'Riz au lait vanille', 'Pain de riz complet', 'Brizzi', 'Riz et pain frais'].forEach((name, i) =>
    insert.run(String(i), name, normalizeSearch(name)),
  );
  const ranked = ciqualCatalog(async () => readerOf(fixture));
  const order = async (query: string) => (await ranked.search(query)).map((f) => f.name);

  // prefix (shorter first), then a word starting with it, then inside a word
  expect(await order('riz')).toEqual(['Riz soufflé', 'Riz et pain frais', 'Riz au lait vanille', 'Pain de riz complet', 'Brizzi']);
  // the first term decides the tier, not the last one
  expect(await order('pain riz')).toEqual(['Pain de riz complet', 'Riz et pain frais']);
  fixture.close();
});

test('a food carries the nutrients per 100 g that Ciqual determines', async () => {
  const rice = await catalog.get('9100');
  expect(rice!.nutrients).toMatchObject({ iron: 1.94, magnesium: 27.7, fiber: 1.53 });
  expect(rice!.nutrients).not.toHaveProperty('vitB9'); // not determined for this food: absent, not 0
  const [first] = await catalog.search('riz blanc cru');
  expect(first.nutrients).toBeDefined();
});
