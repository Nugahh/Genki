import type { OffProduct } from './openFoodFacts';

// Coca-Cola 330 ml as Open Food Facts answered (api/v2/product/5449000000996), reduced to the fields that are asked for.
export const COCA: OffProduct = {
  code: '5449000000996',
  product_name: 'Coca-Cola Original',
  product_name_fr: 'Coca-Cola',
  brands: 'COCA-COLA SERVICES SA/NV',
  quantity: '330 ml',
  product_quantity: 330,
  serving_size: '1 portion (330 ml)',
  serving_quantity: 330,
  nutriments: { 'energy-kcal_100g': 42.4, 'energy-kj_100g': 180, proteins_100g: 0, carbohydrates_100g: 10.6, fat_100g: 0, sugars_100g: 10.6, 'saturated-fat_100g': 0, salt_100g: 0 },
};

// No energy and no macros: a product that was added without its table.
export const EMPTY: OffProduct = { code: '3017620422003', product_name: 'Pâte à tartiner', brands: 'Marque', quantity: '400 g', nutriments: {} };

// Energy in kilojoules only: 1 046 kJ is 250 kcal.
export const KJ_ONLY: OffProduct = {
  code: '3000000000017',
  product_name: 'Biscuit',
  brands: 'Une marque, Une autre',
  quantity: '150 g',
  nutriments: { 'energy-kj_100g': 1046, proteins_100g: 6, carbohydrates_100g: 60, fat_100g: 10 },
};

// Vitamins and minerals are in grams per 100 g in Open Food Facts.
export const WITH_VITAMINS: OffProduct = {
  code: '3000000000024',
  product_name: 'Jus multivitaminé',
  brands: 'Fruits',
  quantity: '1,5 L',
  serving_size: '25 cl',
  nutriments: {
    'energy-kcal_100g': 46, proteins_100g: 0.5, carbohydrates_100g: 10.5, fat_100g: 0.1, fiber_100g: 0.4,
    'vitamin-c_100g': 0.0125, 'vitamin-d_100g': 0.0000015, 'vitamin-pp_100g': 0.0016, 'vitamin-b9_100g': 0.00005, calcium_100g: 0.12, iron_100g: 0.0014, 'vitamin-a_100g': 'not a number',
  },
};
