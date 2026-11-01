import { normalizeSearch } from './normalize';

/**
 * How well a food answers a search; 0 when it does not. Every term must be in the name or in the brand. A name that starts with the search comes
 * first, then one with a word that starts with its first term, then one that contains it, then one that only the brand answers; the brand adds a
 * little, and a shorter name comes before a longer one.
 */
export function relevance(query: string, name: string, brand?: string): number {
  const terms = normalizeSearch(query).split(' ').filter(Boolean);
  if (terms.length === 0) return 0;
  const n = normalizeSearch(name);
  const b = normalizeSearch(brand ?? '');
  if (!terms.every((t) => n.includes(t) || b.includes(t))) return 0;
  const [first] = terms;
  const tier = n.startsWith(terms.join(' ')) ? 100 : ` ${n}`.includes(` ${first}`) ? 60 : n.includes(first) ? 30 : 10;
  return tier + (b.includes(first) ? 10 : 0) - n.length / 1000;
}
