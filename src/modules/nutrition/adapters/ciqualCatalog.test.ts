import { DatabaseSync } from 'node:sqlite';
import { ciqualCatalog, type SqlReader } from './ciqualCatalog';

// The real embedded table, opened read-only through Node's SQLite.
const db = new DatabaseSync('assets/ciqual.db', { readOnly: true });
afterAll(() => db.close());
const reader: SqlReader = {
  getAllAsync: async (sql, params = []) => db.prepare(sql).all(...params) as never,
};
const catalog = ciqualCatalog(async () => reader);

const names = async (query: string, state?: 'raw' | 'cooked') => (await catalog.search(query, { state })).map((f) => f.name);

test('finds foods by name, ignoring accents, case and the œ ligature', async () => {
  expect(await names('RIZ blanc')).toContain('Riz blanc, cru');
  const oeuf = await names('œuf');
  expect(oeuf).toContain('Oeuf cru');
  expect(await names('oeuf')).toEqual(oeuf);
});

test('needs every term and puts names starting with the first term first', async () => {
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
