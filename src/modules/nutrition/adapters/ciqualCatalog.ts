import type { FoodCatalog } from '../application/ports';
import type { Food, FoodState } from '../domain/food';
import { normalizeSearch } from '../domain/normalize';

/** The one method of expo-sqlite's database this adapter needs, so tests can run on Node's SQLite. */
export type SqlReader = { getAllAsync<T>(sql: string, params: (string | number)[]): Promise<T[]> };

type Row = { id: string; name: string; state: FoodState; kcal: number; protein: number; carbs: number; fat: number };
const COLUMNS = 'id, name, state, kcal, protein, carbs, fat';

const toFood = (r: Row): Food => ({
  ref: { type: 'ciqual', id: r.id },
  name: r.name,
  state: r.state,
  per100g: { kcal: r.kcal, protein: r.protein, carbs: r.carbs, fat: r.fat },
  portions: [],
});

/** The embedded Ciqual table. `open` runs on first use and its database is kept. */
export function ciqualCatalog(open: () => Promise<SqlReader>): FoodCatalog {
  let db: Promise<SqlReader> | undefined;
  const reader = () => (db ??= open());

  return {
    async search(query, { state, limit = 30 } = {}) {
      // Terms hold only [a-z0-9] after normalizing, so they carry no LIKE wildcard.
      const terms = normalizeSearch(query).split(' ').filter(Boolean);
      if (terms.length === 0) return [];
      const where = [...terms.map(() => 'search LIKE ?'), ...(state ? ['state = ?'] : [])].join(' AND ');
      const params: (string | number)[] = [...terms.map((t) => `%${t}%`), ...(state ? [state] : [])];
      // Names starting with the first term, then names with a word starting with it, then the rest; shorter first.
      const rows = await (await reader()).getAllAsync<Row>(
        `SELECT ${COLUMNS} FROM foods WHERE ${where}
         ORDER BY CASE WHEN search LIKE ? THEN 0 WHEN search LIKE ? THEN 1 ELSE 2 END, length(name), name
         LIMIT ?`,
        [...params, `${terms[0]}%`, `% ${terms[0]}%`, limit],
      );
      return rows.map(toFood);
    },
    async get(id) {
      const [row] = await (await reader()).getAllAsync<Row>(`SELECT ${COLUMNS} FROM foods WHERE id = ?`, [id]);
      return row ? toFood(row) : undefined;
    },
  };
}
