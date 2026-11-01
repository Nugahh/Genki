import { useEffect, useState } from 'react';
import type { ProductSearch } from '../application/productSearch';
import type { FoodInput } from '../domain/food';

/** The products of brands for a search: `pending` while Open Food Facts is asked, `failed` when it cannot be reached (offline, slow, refused). */
export type BrandProducts = { status: 'idle' | 'pending' | 'done' | 'failed'; foods: FoodInput[] };

const IDLE: BrandProducts = { status: 'idle', foods: [] };

/**
 * The products that answer `query`, asked after the pause in the typing and cancelled when the query changes. Nothing is asked while `enabled` is
 * false (a filter on raw or cooked food leaves the products out).
 */
export function useBrandProducts(products: ProductSearch, query: string, enabled: boolean): BrandProducts {
  // The answer keeps the query it is for: the products of another query are never shown for this one.
  const [answer, setAnswer] = useState<{ query: string; result: BrandProducts } | null>(null);
  const text = query.trim();
  const asked = enabled && text.length >= 3;

  useEffect(() => {
    if (!asked) return;
    const controller = new AbortController();
    products.search(text, controller.signal).then(
      (foods) => setAnswer({ query: text, result: { status: 'done', foods } }),
      (error) => {
        if (error?.name === 'AbortError' || controller.signal.aborted) return;
        console.warn(error);
        setAnswer({ query: text, result: { status: 'failed', foods: [] } });
      },
    );
    return () => controller.abort();
  }, [products, text, asked]);

  if (!asked) return IDLE;
  return answer?.query === text ? answer.result : { status: 'pending', foods: [] };
}
