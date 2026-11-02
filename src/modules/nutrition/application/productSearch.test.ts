import { COCA, EMPTY, KJ_ONLY } from '../domain/openFoodFacts.fixtures';
import { rateLimiter } from '../domain/rateLimiter';
import type { ProductSource } from './ports';
import { productSearch } from './productSearch';

beforeEach(() => jest.useFakeTimers({ now: new Date('2026-11-01T10:00:00Z') }));
afterEach(() => jest.useRealTimers());

function setup(source: Partial<ProductSource> = {}) {
  const full: ProductSource = {
    search: jest.fn(async () => [COCA]),
    byBarcode: jest.fn(async () => COCA),
    ...source,
  };
  return { full, products: productSearch({ source: full, limiter: rateLimiter(10, 60000, Date.now), lookupLimiter: rateLimiter(15, 60000, Date.now) }) };
}
const signal = () => new AbortController().signal;

describe('search', () => {
  test('waits for a pause in the typing of 700 ms before asking', async () => {
    const { full, products } = setup();
    const result = products.search('coca', signal());
    await jest.advanceTimersByTimeAsync(699);
    expect(full.search).not.toHaveBeenCalled();
    await jest.advanceTimersByTimeAsync(1);
    expect(full.search).toHaveBeenCalledWith('coca', expect.anything());
    expect(await result).toHaveLength(1);
  });

  test('does not ask for fewer than 3 characters', async () => {
    const { full, products } = setup();
    expect(await products.search(' co ', signal())).toEqual([]);
    await jest.advanceTimersByTimeAsync(5000);
    expect(full.search).not.toHaveBeenCalled();
  });

  test('a search that is replaced during the pause never asks', async () => {
    const { full, products } = setup();
    const controller = new AbortController();
    const result = products.search('coca', controller.signal);
    const outcome = expect(result).rejects.toMatchObject({ name: 'AbortError' });
    await jest.advanceTimersByTimeAsync(300);
    controller.abort();
    await outcome;
    await jest.advanceTimersByTimeAsync(2000);
    expect(full.search).not.toHaveBeenCalled();
  });

  test('gives the products as foods of Open Food Facts, leaves out those that cannot be used and the same product twice', async () => {
    const { products } = setup({ search: jest.fn(async () => [COCA, EMPTY, KJ_ONLY, COCA]) });
    const result = products.search('coca', signal());
    await jest.advanceTimersByTimeAsync(700);
    expect((await result).map((f) => f.name)).toEqual(['Coca-Cola', 'Biscuit']);
  });

  test('a failure of Open Food Facts is the caller\'s to say', async () => {
    const { products } = setup({ search: jest.fn(async () => { throw new Error('Open Food Facts : HTTP 503'); }) });
    const result = products.search('coca', signal());
    const outcome = expect(result).rejects.toThrow('HTTP 503');
    await jest.advanceTimersByTimeAsync(700);
    await outcome;
  });

  test('never asks more than 10 times in a minute: the 11th waits for a slot', async () => {
    const { full, products } = setup();
    for (let i = 0; i < 10; i++) {
      const done = products.search(`coca ${i}`, signal());
      await jest.advanceTimersByTimeAsync(700);
      await done;
    }
    expect(full.search).toHaveBeenCalledTimes(10);
    const eleventh = products.search('coca 10', signal());
    await jest.advanceTimersByTimeAsync(700);
    expect(full.search).toHaveBeenCalledTimes(10);
    await jest.advanceTimersByTimeAsync(60000 - 7000);
    await eleventh;
    expect(full.search).toHaveBeenCalledTimes(11);
  });
});

describe('lookup', () => {
  test('finds a product by its barcode, at once (no pause)', async () => {
    const { full, products } = setup();
    expect(await products.lookup('5449000000996', signal())).toMatchObject({ kind: 'found', food: { name: 'Coca-Cola', barcode: '5449000000996' } });
    expect(full.byBarcode).toHaveBeenCalledWith('5449000000996', expect.anything());
  });

  test('a product that Open Food Facts does not know', async () => {
    const { products } = setup({ byBarcode: jest.fn(async () => undefined) });
    expect(await products.lookup('5449000000996', signal())).toEqual({ kind: 'unknown' });
  });

  test('a product without its calories or macros is said, with the reason', async () => {
    const { products } = setup({ byBarcode: jest.fn(async () => EMPTY) });
    expect(await products.lookup('3017620422003', signal())).toEqual({ kind: 'refused', reason: 'Open Food Facts ne donne pas les calories et les macros de ce produit.' });
  });

  test('the barcode of the product is the one that was scanned when the answer has none', async () => {
    const { products } = setup({ byBarcode: jest.fn(async () => ({ ...COCA, code: undefined })) });
    expect(await products.lookup('5449000000996', signal())).toMatchObject({ kind: 'found', food: { barcode: '5449000000996' } });
  });

  test('a network failure is thrown', async () => {
    const { products } = setup({ byBarcode: jest.fn(async () => { throw new Error('Network request failed'); }) });
    await expect(products.lookup('5449000000996', signal())).rejects.toThrow('Network request failed');
  });
});

describe('the two limits', () => {
  test('reading a product has its own limit of 15 a minute, apart from the 10 searches', async () => {
    const { full, products } = setup();
    for (let i = 0; i < 10; i++) {
      const done = products.search(`coca ${i}`, signal());
      await jest.advanceTimersByTimeAsync(700);
      await done;
    }
    // Ten searches have used all the searches of the minute; reading a product is not held back by them.
    expect(await products.lookup('5449000000996', signal())).toMatchObject({ kind: 'found' });
    expect(full.byBarcode).toHaveBeenCalledTimes(1);
  });

  test('the 16th product read of a minute waits for a slot', async () => {
    const { full, products } = setup();
    for (let i = 0; i < 15; i++) await products.lookup('5449000000996', signal());
    expect(full.byBarcode).toHaveBeenCalledTimes(15);
    const sixteenth = products.lookup('5449000000996', signal());
    await jest.advanceTimersByTimeAsync(59000);
    expect(full.byBarcode).toHaveBeenCalledTimes(15);
    await jest.advanceTimersByTimeAsync(1000);
    await sixteenth;
    expect(full.byBarcode).toHaveBeenCalledTimes(16);
  });
});
