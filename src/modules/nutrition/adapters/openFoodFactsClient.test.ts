import { COCA } from '../domain/openFoodFacts.fixtures';
import { openFoodFactsClient } from './openFoodFactsClient';

const json = (body: unknown, init: { ok?: boolean; status?: number } = {}) => ({ ok: init.ok ?? true, status: init.status ?? 200, json: async () => body }) as Response;
const setup = (answer: () => Promise<Response> = async () => json({ products: [COCA] })) => {
  const fetchMock = jest.fn((_url: string, _init?: RequestInit) => answer());
  return { fetchMock, client: openFoodFactsClient(fetchMock as never) };
};
const signal = () => new AbortController().signal;

afterEach(() => jest.useRealTimers());

describe('search', () => {
  test('asks for the French list of 20, with the fields it needs, and says who asks, without anything about the user', async () => {
    const { client, fetchMock } = setup();
    await client.search('coca cola & co', signal());
    const [url, init] = fetchMock.mock.calls[0];
    const query = new URL(url).searchParams;
    expect(new URL(url).origin + new URL(url).pathname).toBe('https://world.openfoodfacts.org/cgi/search.pl');
    expect([query.get('search_terms'), query.get('json'), query.get('lc'), query.get('page_size'), query.get('search_simple'), query.get('action')]).toEqual(['coca cola & co', '1', 'fr', '20', '1', 'process']);
    expect(query.get('fields')).toBe('code,product_name,product_name_fr,brands,quantity,product_quantity,serving_size,serving_quantity,nutriments');
    expect(init?.headers).toEqual({ 'User-Agent': 'Genki/1.0 (personal app; github.com/Nugahh/Genki)', Accept: 'application/json' });
  });

  test('gives the products, and none when the answer has no list', async () => {
    expect(await setup().client.search('coca', signal())).toEqual([COCA]);
    expect(await setup(async () => json({})).client.search('coca', signal())).toEqual([]);
    expect(await setup(async () => json({ products: [] })).client.search('coca', signal())).toEqual([]);
  });

  test('an HTTP error is an error', async () => {
    const { client } = setup(async () => json({}, { ok: false, status: 503 }));
    await expect(client.search('coca', signal())).rejects.toThrow('HTTP 503');
  });

  test('an answer that is not JSON is an error', async () => {
    const { client } = setup(async () => ({ ok: true, status: 200, json: async () => { throw new SyntaxError('Unexpected token'); } }) as unknown as Response);
    await expect(client.search('coca', signal())).rejects.toThrow();
  });

  test('gives up after 8 seconds and cancels the request', async () => {
    jest.useFakeTimers();
    let sent: AbortSignal | null | undefined;
    const fetchMock = jest.fn((_url: string, init?: RequestInit) => {
      sent = init?.signal;
      return new Promise<Response>((_, reject) => init?.signal?.addEventListener('abort', () => reject(new Error('aborted'))));
    });
    const slow = openFoodFactsClient(fetchMock as never);
    const result = slow.search('coca', signal());
    const outcome = expect(result).rejects.toThrow('Open Food Facts ne répond pas');
    await jest.advanceTimersByTimeAsync(8000);
    await outcome;
    expect(sent?.aborted).toBe(true);
  });

  test('stops with the caller: a search that is replaced is cancelled', async () => {
    const controller = new AbortController();
    let sent: AbortSignal | null | undefined;
    const fetchMock = jest.fn((_url: string, init?: RequestInit) => {
      sent = init?.signal;
      return new Promise<Response>((_, reject) => init?.signal?.addEventListener('abort', () => reject(new Error('aborted'))));
    });
    const result = openFoodFactsClient(fetchMock as never).search('coca', controller.signal);
    controller.abort();
    await expect(result).rejects.toThrow('aborted');
    expect(sent?.aborted).toBe(true);
  });
});

describe('byBarcode', () => {
  test('asks for the product by its code, with the same fields and the same header', async () => {
    const { client, fetchMock } = setup(async () => json({ status: 1, product: COCA }));
    expect(await client.byBarcode('5449000000996', signal())).toEqual(COCA);
    const [url, init] = fetchMock.mock.calls[0];
    expect(new URL(url).pathname).toBe('/api/v2/product/5449000000996.json');
    expect(new URL(url).searchParams.get('fields')).toBe('code,product_name,product_name_fr,brands,quantity,product_quantity,serving_size,serving_quantity,nutriments');
    expect((init?.headers as Record<string, string>)['User-Agent']).toBe('Genki/1.0 (personal app; github.com/Nugahh/Genki)');
  });

  test('a product that Open Food Facts does not know is nothing', async () => {
    expect(await setup(async () => json({ status: 0, status_verbose: 'product not found' })).client.byBarcode('5449000000996', signal())).toBeUndefined();
    expect(await setup(async () => json({ status: 1 })).client.byBarcode('5449000000996', signal())).toBeUndefined();
  });

  test('a barcode it does not know is answered with an HTTP 404, which is not a failure', async () => {
    const { client } = setup(async () => json({ status: 0, status_verbose: 'product not found' }, { ok: false, status: 404 }));
    expect(await client.byBarcode('2222222222220', signal())).toBeUndefined();
  });

  test('any other HTTP error is a failure', async () => {
    const { client } = setup(async () => json({}, { ok: false, status: 503 }));
    await expect(client.byBarcode('5449000000996', signal())).rejects.toThrow('HTTP 503');
  });

  test('a code that is not 8 to 14 digits is never sent', async () => {
    const { client, fetchMock } = setup();
    await expect(client.byBarcode('../../etc', signal())).rejects.toThrow('code-barres');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
