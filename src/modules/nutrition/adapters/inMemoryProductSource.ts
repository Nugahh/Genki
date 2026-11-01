import type { ProductSource } from '../application/ports';
import { normalizeSearch } from '../domain/normalize';
import type { OffProduct } from '../domain/openFoodFacts';

/** ProductSource over a fixed list of products, for tests: a search keeps the products whose name or brand holds every term. */
export function inMemoryProductSource(products: OffProduct[] = []): ProductSource {
  return {
    async search(query) {
      const terms = normalizeSearch(query).split(' ').filter(Boolean);
      return products.filter((p) => {
        const text = normalizeSearch(`${p.product_name_fr ?? ''} ${p.product_name ?? ''} ${p.brands ?? ''}`);
        return terms.every((t) => text.includes(t));
      });
    },
    async byBarcode(code) {
      return products.find((p) => p.code === code);
    },
  };
}
