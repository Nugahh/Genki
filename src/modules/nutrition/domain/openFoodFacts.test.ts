import { COCA, EMPTY, KJ_ONLY, WITH_VITAMINS } from './openFoodFacts.fixtures';
import { fromOpenFoodFacts, parseQuantity } from './openFoodFacts';

describe('parseQuantity', () => {
  test.each([
    ['330 ml', 330, true],
    ['1,5 L', 1500, true],
    ['33 cl', 330, true],
    ['250 g', 250, false],
    ['1.5 kg', 1500, false],
    ['1 portion (330 ml)', 330, true],
  ] as const)('%s is %s g (volume: %s)', (text, grams, approx) => {
    expect(parseQuantity(text)).toMatchObject({ grams, approx });
  });

  test('keeps the amount as it was written, for the label of a portion', () => {
    expect(parseQuantity('1 portion (1,5 L)')?.amount).toBe('1,5 L');
  });

  test.each(['', 'une canette', '6 x 33 cl', '6x33cl', '12 pièces'])('%j has no weight', (text) => {
    expect(parseQuantity(text)).toBeUndefined();
  });
});

describe('fromOpenFoodFacts', () => {
  test('Coca-Cola 330 ml: the French name, the brand, the macros per 100 g, a portion of a can', () => {
    const result = fromOpenFoodFacts(COCA);
    expect(result).toEqual({
      ok: true,
      food: {
        name: 'Coca-Cola', state: 'other', per100g: { kcal: 42.4, protein: 0, carbs: 10.6, fat: 0 },
        portions: [{ label: 'Portion 330 ml ≈ 330 g', grams: 330 }],
        nutrients: { sugars: 10.6, saturatedFat: 0, salt: 0 },
        source: 'off', brand: 'COCA-COLA SERVICES SA/NV', barcode: '5449000000996',
      },
    });
  });

  test('a package that is not the portion is a portion too; the same weight is listed once', () => {
    const result = fromOpenFoodFacts(WITH_VITAMINS);
    expect(result.ok && result.food.portions).toEqual([
      { label: 'Portion 25 cl ≈ 250 g', grams: 250 },
      { label: 'Emballage 1,5 L ≈ 1500 g', grams: 1500 },
    ]);
  });

  test('a product without energy or without a macro is refused, with a message', () => {
    expect(fromOpenFoodFacts(EMPTY)).toEqual({ ok: false, reason: 'Open Food Facts ne donne pas les calories et les macros de ce produit.' });
    const noFat = { ...COCA, nutriments: { 'energy-kcal_100g': 42, proteins_100g: 0, carbohydrates_100g: 10 } };
    expect(fromOpenFoodFacts(noFat).ok).toBe(false);
  });

  test('energy in kilojoules only is divided by 4.184', () => {
    const result = fromOpenFoodFacts(KJ_ONLY);
    expect(result.ok && result.food.per100g.kcal).toBe(250);
  });

  test('the first brand, the name when there is no French one, and a name when there is none', () => {
    expect(fromOpenFoodFacts(KJ_ONLY)).toMatchObject({ ok: true, food: { name: 'Biscuit', brand: 'Une marque' } });
    expect(fromOpenFoodFacts({ ...KJ_ONLY, product_name: '  ', brands: undefined })).toMatchObject({ ok: true, food: { name: 'Produit sans nom' } });
  });

  test('vitamins and minerals, given in grams, come out in the unit of the catalogue; what is unreadable is left out', () => {
    const result = fromOpenFoodFacts(WITH_VITAMINS);
    expect(result.ok && result.food.nutrients).toEqual({ fiber: 0.4, vitC: 12.5, vitD: 1.5, vitB3: 1.6, vitB9: 50, calcium: 120, iron: 1.4 });
  });

  test('values that cannot be true are refused rather than recorded', () => {
    const impossible = { ...COCA, nutriments: { ...COCA.nutriments, 'energy-kcal_100g': 4000 } };
    expect(fromOpenFoodFacts(impossible)).toEqual({ ok: false, reason: 'Les valeurs de ce produit ne sont pas plausibles.' });
    const tooMuch = { ...COCA, nutriments: { ...COCA.nutriments, proteins_100g: 80, carbohydrates_100g: 80 } };
    expect(fromOpenFoodFacts(tooMuch).ok).toBe(false);
  });

  test('a portion that cannot be is left out and the product is kept', () => {
    for (const [serving_size, quantity] of [['0 g', '330 ml'], ['1 portion (330 ml)', '25 kg'], ['6 l', '5001 g']] as const) {
      const result = fromOpenFoodFacts({ ...COCA, serving_size, quantity });
      expect(result.ok).toBe(true);
      expect(result.ok && result.food.portions.every((p) => p.grams > 0 && p.grams <= 5000)).toBe(true);
    }
    expect(fromOpenFoodFacts({ ...COCA, serving_size: '0 g', quantity: '25 kg' })).toMatchObject({ ok: true, food: { portions: [] } });
  });

  test('a portion of 100 g is not listed: it is always offered', () => {
    expect(fromOpenFoodFacts({ ...COCA, serving_size: '100 g', quantity: '100 g' })).toMatchObject({ ok: true, food: { portions: [] } });
  });

  test('an empty reading is not a zero, and a field that is not text does not break the product', () => {
    expect(fromOpenFoodFacts({ ...COCA, nutriments: { ...COCA.nutriments, carbohydrates_100g: '' } }).ok).toBe(false);
    const odd = { ...COCA, product_name_fr: 42 as never, product_name: ['x'] as never, brands: 7 as never, serving_size: 330 as never };
    expect(fromOpenFoodFacts(odd)).toMatchObject({ ok: true, food: { name: 'Produit sans nom' } });
  });

  test('a nutrient in grams for 100 g cannot pass 100 g', () => {
    const result = fromOpenFoodFacts({ ...COCA, nutriments: { ...COCA.nutriments, salt_100g: 5000, fiber_100g: 3 } });
    expect(result.ok && result.food.nutrients).toEqual({ sugars: 10.6, saturatedFat: 0, fiber: 3 });
  });

  test('a name or a brand longer than the rules allow is cut', () => {
    const result = fromOpenFoodFacts({ ...COCA, product_name_fr: 'x'.repeat(150), brands: 'y'.repeat(150) });
    expect(result.ok && [result.food.name.length, result.food.brand?.length]).toEqual([100, 100]);
  });

  test('a code that is not 8 to 14 digits is not kept', () => {
    expect(fromOpenFoodFacts({ ...COCA, code: 'abc' })).toMatchObject({ ok: true, food: expect.not.objectContaining({ barcode: expect.anything() }) });
  });
});
