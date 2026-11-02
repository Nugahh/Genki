import type { ProductSource } from '../application/ports';
import type { OffProduct } from '../domain/openFoodFacts';

// The product by barcode comes from the main API; the search by name from Search-a-licious, its search engine. The old search of the main API
// (cgi/search.pl) answered 503 about half the time to an anonymous client.
const BASE = 'https://world.openfoodfacts.org';
const SEARCH_BASE = 'https://search.openfoodfacts.org';
const FIELDS = 'code,product_name,product_name_fr,brands,quantity,product_quantity,serving_size,serving_quantity,nutriments';
// The index holds the name, brands, quantity and the macros with fibre, sugars, salt: not the vitamins, nor the portion of the label (the product has them).
const HIT_FIELDS = 'code,product_name,product_name_fr,brands,quantity,nutriments';
const HITS = 30;

/** A hit of Search-a-licious has its brands as a list; a product of the main API has them as one text. */
type Hit = Omit<OffProduct, 'brands'> & { brands?: string[] | string };
// Who asks, as Open Food Facts requires: an app name and a way to reach its author. Never the e-mail of the user.
const HEADERS = { 'User-Agent': 'Genki/1.0 (personal app; github.com/Nugahh/Genki)', Accept: 'application/json' };
const TIMEOUT_MS = 8000;

/** Open Food Facts over `fetch`. Only the text searched or the barcode leaves the phone, with no identifier of the account. */
export function openFoodFactsClient(fetchFn: typeof fetch = fetch): ProductSource {
  /** `notFound` is what to give for an HTTP 404: Open Food Facts answers 404 with `{ status: 0 }` for a barcode it does not know. */
  async function get(url: string, caller: AbortSignal, notFound?: unknown): Promise<unknown> {
    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, TIMEOUT_MS);
    const stop = () => controller.abort();
    if (caller.aborted) stop();
    caller.addEventListener('abort', stop);
    try {
      const response = await fetchFn(url, { headers: HEADERS, signal: controller.signal });
      if (response.status === 404 && notFound !== undefined) return notFound;
      if (!response.ok) throw new Error(`Open Food Facts : HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      if (timedOut) throw new Error('Open Food Facts ne répond pas.');
      throw error;
    } finally {
      clearTimeout(timer);
      caller.removeEventListener('abort', stop);
    }
  }

  return {
    async search(query, signal) {
      // The query language of the service (Lucene) gives a meaning to : " ( ) + - ! * and more: only the words are sent, as the user means them.
      const words = query.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
      if (words === '') return [];
      const url = `${SEARCH_BASE}/search?q=${encodeURIComponent(words)}&langs=fr,en&page_size=${HITS}&fields=${HIT_FIELDS}`;
      const body = (await get(url, signal)) as { hits?: Hit[] };
      return Array.isArray(body.hits) ? body.hits.map((hit) => ({ ...hit, brands: Array.isArray(hit.brands) ? hit.brands.join(',') : hit.brands })) : [];
    },
    async byBarcode(code, signal) {
      if (!/^\d{8,14}$/.test(code)) throw new Error('Ce code-barres n’est pas valide.');
      const body = (await get(`${BASE}/api/v2/product/${code}.json?fields=${FIELDS}`, signal, { status: 0 })) as { status?: number; product?: OffProduct };
      return body.status === 1 && body.product ? body.product : undefined;
    },
  };
}
