import { useEffect, useState } from 'react';
import type { ProductSearch } from '../application/productSearch';
import type { FoodInput } from '../domain/food';

/**
 * The products of brands for a search: `pending` while Open Food Facts is asked, `failed` when it cannot be reached (offline, busy, slow, refused);
 * `retry` asks again after a failure.
 */
export type BrandProducts = { status: 'idle' | 'pending' | 'done' | 'failed'; foods: FoodInput[]; retry?: () => void };

const IDLE: BrandProducts = { status: 'idle', foods: [] };

/**
 * The products that answer `query`, asked after the pause in the typing and cancelled when the query changes. Nothing is asked while `enabled` is
 * false (a filter on raw or cooked food leaves the products out).
 */
export function useBrandProducts(products: ProductSearch, query: string, enabled: boolean): BrandProducts {
  // The answer keeps the query and the attempt it is for: the products of another query are never shown for this one.
  const [answer, setAnswer] = useState<{ query: string; attempt: number; result: BrandProducts } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const text = query.trim();
  const asked = enabled && text.length >= 3;

  useEffect(() => {
    if (!asked) return;
    const controller = new AbortController();
    products.search(text, controller.signal).then(
      (foods) => setAnswer({ query: text, attempt, result: { status: 'done', foods } }),
      (error) => {
        if (error?.name === 'AbortError' || controller.signal.aborted) return;
        setAnswer({ query: text, attempt, result: { status: 'failed', foods: [] } });
      },
    );
    return () => controller.abort();
  }, [products, text, asked, attempt]);

  if (!asked) return IDLE;
  if (answer?.query !== text || answer.attempt !== attempt) return { status: 'pending', foods: [] };
  return answer.result.status === 'failed' ? { ...answer.result, retry: () => setAttempt((n) => n + 1) } : answer.result;
}
