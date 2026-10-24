import { macrosFor, scaleMacros, subtractMacros, sumMacros } from './macros';

const rice = { kcal: 354, protein: 7.1, carbs: 78.5, fat: 0.6 };

test('macrosFor scales per-100 g values to the quantity, rounded to 0.1', () => {
  expect(macrosFor(rice, 200)).toEqual({ kcal: 708, protein: 14.2, carbs: 157, fat: 1.2 });
  expect(macrosFor(rice, 33)).toEqual({ kcal: 116.8, protein: 2.3, carbs: 25.9, fat: 0.2 });
});

test('scaleMacros rescales an entry from its own frozen values, not from the food', () => {
  expect(scaleMacros({ kcal: 708, protein: 14.2, carbs: 157, fat: 1.2 }, 200, 100)).toEqual({ kcal: 354, protein: 7.1, carbs: 78.5, fat: 0.6 });
  // Rounded to 0.1 as well: 116.8 × 100 / 33 is 353.939…
  expect(scaleMacros({ kcal: 116.8, protein: 2.3, carbs: 25.9, fat: 0.2 }, 33, 100)).toEqual({ kcal: 353.9, protein: 7, carbs: 78.5, fat: 0.6 });
});

test('sumMacros adds up and subtractMacros takes away, without float noise', () => {
  const a = { kcal: 0.1, protein: 0.1, carbs: 0.1, fat: 0.1 };
  const b = { kcal: 0.2, protein: 0.2, carbs: 0.2, fat: 0.2 };
  expect(sumMacros([a, b])).toEqual({ kcal: 0.3, protein: 0.3, carbs: 0.3, fat: 0.3 });
  expect(sumMacros([])).toEqual({ kcal: 0, protein: 0, carbs: 0, fat: 0 });
  expect(subtractMacros(b, a)).toEqual(a);
  expect(subtractMacros({ kcal: 0.3, protein: 0.3, carbs: 0.3, fat: 0.3 }, a)).toEqual(b); // 0.3 − 0.1 is 0.19999999999999998 unrounded
});
