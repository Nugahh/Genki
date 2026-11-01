import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { PaperProvider } from 'react-native-paper';
import { inMemoryFoodCatalog } from '../adapters/inMemoryFoodCatalog';
import { inMemoryFoodRepository } from '../adapters/inMemoryFoodRepository';
import { inMemoryProductSource } from '../adapters/inMemoryProductSource';
import { foodUseCases } from '../application/foodUseCases';
import type { ProductSource } from '../application/ports';
import { productSearch } from '../application/productSearch';
import type { Food } from '../domain/food';
import { COCA, EMPTY } from '../domain/openFoodFacts.fixtures';
import { rateLimiter } from '../domain/rateLimiter';
import { ScanScreen, type ScanCamera } from './ScanScreen';

const mine: Food = {
  ref: { type: 'custom', id: 'c1' }, name: 'Mon yaourt', state: 'other', per100g: { kcal: 60, protein: 4, carbs: 5, fat: 3 }, portions: [], barcode: '3033710065967',
};

async function setup({ source = inMemoryProductSource([COCA]), custom = [] as Food[] } = {}) {
  let scan: (code: string) => void = () => {};
  const Camera: ScanCamera = ({ onScan }) => {
    scan = onScan;
    return <Text>Caméra</Text>;
  };
  const foods = foodUseCases({ catalog: inMemoryFoodCatalog([]), repo: inMemoryFoodRepository() });
  const products = productSearch({ source, limiter: rateLimiter(10, 60000, Date.now), pauseMs: 0 });
  const onFound = jest.fn();
  const onCreate = jest.fn();
  const onBack = jest.fn();
  await render(
    <PaperProvider>
      <ScanScreen camera={Camera} foods={foods} products={products} custom={custom} onFound={onFound} onCreate={onCreate} onBack={onBack} />
    </PaperProvider>,
  );
  return { read: (code: string) => act(async () => scan(code)), onFound, onCreate, onBack };
}

test('shows the camera, and « Retour » leaves', async () => {
  const { onBack } = await setup();
  expect(screen.getByText('Caméra')).toBeTruthy();
  await fireEvent.press(screen.getByText('Retour'));
  expect(onBack).toHaveBeenCalled();
});

test('a product that Open Food Facts knows opens as a product', async () => {
  const { read, onFound } = await setup();
  await read('5449000000996');
  expect(onFound).toHaveBeenCalledWith({ product: expect.objectContaining({ name: 'Coca-Cola', barcode: '5449000000996', source: 'off' }) });
});

test('a food the user already has for this barcode is found first, without asking Open Food Facts', async () => {
  const source: ProductSource = { search: jest.fn(async () => []), byBarcode: jest.fn(async () => COCA) };
  const { read, onFound } = await setup({ source, custom: [mine] });
  await read('3033710065967');
  expect(onFound).toHaveBeenCalledWith({ food: mine });
  expect(source.byBarcode).not.toHaveBeenCalled();
});

test('what is not a barcode of a product is ignored', async () => {
  const source: ProductSource = { search: jest.fn(async () => []), byBarcode: jest.fn(async () => COCA) };
  const { read, onFound } = await setup({ source });
  for (const junk of ['', 'abc', '12345', 'https://exemple.fr/?q=1', '12345678901234567']) await read(junk);
  expect(source.byBarcode).not.toHaveBeenCalled();
  expect(onFound).not.toHaveBeenCalled();
});

test('the camera reads the same code many times a second: one lookup', async () => {
  let release!: (p: typeof COCA) => void;
  const byBarcode = jest.fn(() => new Promise<typeof COCA>((r) => (release = r)));
  const { read, onFound } = await setup({ source: { search: async () => [], byBarcode } });
  await read('5449000000996');
  await read('5449000000996');
  await read('5449000000996');
  expect(byBarcode).toHaveBeenCalledTimes(1);
  expect(screen.getByText('Recherche du produit…')).toBeTruthy();
  await act(async () => release(COCA));
  expect(onFound).toHaveBeenCalledTimes(1);
});

test('a UPC-A code of 12 digits is asked as the EAN-13 that Open Food Facts keeps', async () => {
  const byBarcode = jest.fn(async () => undefined);
  const { read } = await setup({ source: { search: async () => [], byBarcode } });
  await read('012345678905');
  expect(byBarcode).toHaveBeenCalledWith('0012345678905', expect.anything());
});

test('an unknown product offers to create the food, with the barcode, or to scan again', async () => {
  const { read, onCreate } = await setup();
  await read('3017620422003');
  expect(screen.getByText('Ce produit n’est pas dans Open Food Facts.')).toBeTruthy();
  await fireEvent.press(screen.getByText('Créer un aliment'));
  expect(onCreate).toHaveBeenCalledWith('3017620422003');
});

test('« Scanner à nouveau » brings the camera back, and the next code is read', async () => {
  const { read, onFound } = await setup();
  await read('3017620422003');
  await fireEvent.press(screen.getByText('Scanner à nouveau'));
  expect(screen.getByText('Caméra')).toBeTruthy();
  await read('5449000000996');
  expect(onFound).toHaveBeenCalledTimes(1);
});

test('a product without its calories or macros says why it is not proposed', async () => {
  const { read, onFound, onCreate } = await setup({ source: inMemoryProductSource([{ ...EMPTY, code: '3017620422003' }]) });
  await read('3017620422003');
  expect(screen.getByText('Open Food Facts ne donne pas les calories et les macros de ce produit.')).toBeTruthy();
  expect(onFound).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByText('Créer un aliment'));
  expect(onCreate).toHaveBeenCalledWith('3017620422003');
});

test('offline, for a product never used: a clear message, and « Réessayer » asks again', async () => {
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  const byBarcode = jest.fn().mockRejectedValueOnce(new Error('Network request failed')).mockResolvedValueOnce(COCA);
  const { read, onFound } = await setup({ source: { search: async () => [], byBarcode } });
  await read('5449000000996');
  expect(screen.getByText('Impossible de joindre Open Food Facts. Ce produit n’a encore jamais été utilisé : il faut du réseau.').props.accessibilityLiveRegion).toBe('polite');
  await fireEvent.press(screen.getByText('Réessayer'));
  expect(onFound).toHaveBeenCalledWith({ product: expect.objectContaining({ name: 'Coca-Cola' }) });
});
