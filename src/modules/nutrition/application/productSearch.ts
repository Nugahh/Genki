import type { FoodInput } from '../domain/food';
import { fromOpenFoodFacts } from '../domain/openFoodFacts';
import type { rateLimiter } from '../domain/rateLimiter';
import type { ProductSource } from './ports';

const PAUSE_MS = 700;
const MIN_CHARACTERS = 3;

const aborted = () => Object.assign(new Error('Recherche annulée.'), { name: 'AbortError' });

/** Waits `ms`, or rejects as soon as the signal says to stop. */
function wait(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(aborted());
    if (ms <= 0) return resolve();
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', stop);
      resolve();
    }, ms);
    const stop = () => {
      clearTimeout(timer);
      reject(aborted());
    };
    signal.addEventListener('abort', stop, { once: true });
  });
}

export type Lookup = { kind: 'found'; food: FoodInput } | { kind: 'unknown' } | { kind: 'refused'; reason: string };

/**
 * The products of brands: the search by name (after a pause in the typing, from 3 characters, never more than `limiter` allows, cancelled as soon
 * as the signal says so) and the read of one product by its barcode (within `lookupLimiter`). Open Food Facts asks for no more than 10 searches
 * and 15 product reads a minute, each limit apart.
 */
export function productSearch(deps: { source: ProductSource; limiter: ReturnType<typeof rateLimiter>; lookupLimiter: ReturnType<typeof rateLimiter>; pauseMs?: number }) {
  const { source, limiter, lookupLimiter, pauseMs = PAUSE_MS } = deps;
  return {
    /** The foods the products can become, usable ones only, each barcode once. Rejects with an `AbortError` when replaced. */
    async search(query: string, signal: AbortSignal): Promise<FoodInput[]> {
      const text = query.trim();
      if (text.length < MIN_CHARACTERS) return [];
      await wait(pauseMs, signal);
      await wait(limiter.reserve(), signal);
      const found = await source.search(text, signal);
      const seen = new Set<string>();
      const foods: FoodInput[] = [];
      for (const product of found) {
        const converted = fromOpenFoodFacts(product);
        if (!converted.ok || (converted.food.barcode && seen.has(converted.food.barcode))) continue;
        if (converted.food.barcode) seen.add(converted.food.barcode);
        foods.push(converted.food);
      }
      return foods;
    },
    /** One product by its barcode: at once (a scan, or the touch of a result, is one deliberate request), but within the limit of product reads. */
    async lookup(code: string, signal: AbortSignal): Promise<Lookup> {
      await wait(lookupLimiter.reserve(), signal);
      const product = await source.byBarcode(code, signal);
      if (!product) return { kind: 'unknown' };
      const converted = fromOpenFoodFacts({ ...product, code: product.code ?? code });
      return converted.ok ? { kind: 'found', food: converted.food } : { kind: 'refused', reason: converted.reason };
    },
  };
}

export type ProductSearch = ReturnType<typeof productSearch>;
