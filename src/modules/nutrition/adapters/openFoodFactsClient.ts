import type { ProductSource } from '../application/ports';
import type { OffProduct } from '../domain/openFoodFacts';

const BASE = 'https://world.openfoodfacts.org';
const FIELDS = 'code,product_name,product_name_fr,brands,quantity,product_quantity,serving_size,serving_quantity,nutriments';
// Who asks, as Open Food Facts requires: an app name and a way to reach its author. Never the e-mail of the user.
const HEADERS = { 'User-Agent': 'Genki/1.0 (personal app; github.com/Nugahh/Genki)', Accept: 'application/json' };
const TIMEOUT_MS = 8000;

/** Open Food Facts over `fetch`. Only the text searched or the barcode leaves the phone, with no identifier of the account. */
export function openFoodFactsClient(fetchFn: typeof fetch = fetch): ProductSource {
  async function get(url: string, caller: AbortSignal): Promise<unknown> {
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
      const url = `${BASE}/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&lc=fr&page_size=20&fields=${FIELDS}`;
      const body = (await get(url, signal)) as { products?: OffProduct[] };
      return Array.isArray(body.products) ? body.products : [];
    },
    async byBarcode(code, signal) {
      if (!/^\d{8,14}$/.test(code)) throw new Error('Ce code-barres n’est pas valide.');
      const body = (await get(`${BASE}/api/v2/product/${code}.json?fields=${FIELDS}`, signal)) as { status?: number; product?: OffProduct };
      return body.status === 1 && body.product ? body.product : undefined;
    },
  };
}
