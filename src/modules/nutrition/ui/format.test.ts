import { asText, gramsText, kcalText, macrosText, parseNumber } from './format';

test('calories are whole numbers, grams keep one decimal, both with French separators', () => {
  expect(kcalText(349.6)).toBe('350');
  expect(kcalText(2200)).toBe((2200).toLocaleString('fr-FR'));
  expect(gramsText(7)).toBe('7');
  expect(gramsText(0.6)).toBe('0,6');
  expect(macrosText({ kcal: 350, protein: 7, carbs: 78, fat: 0.6 })).toBe('350 kcal · 7 g de protéines · 78 g de glucides · 0,6 g de lipides');
});

test('a number is read with a comma or a point, NaN when there is none', () => {
  expect(parseNumber('150')).toBe(150);
  expect(parseNumber('150,5')).toBe(150.5);
  expect(parseNumber('150.5')).toBe(150.5);
  expect(parseNumber('')).toBeNaN();
  expect(parseNumber('  ')).toBeNaN();
  expect(parseNumber('abc')).toBeNaN();
  expect(parseNumber('1,5,5')).toBeNaN();
});

test('a number goes back into a field with a comma, and is read again as it was', () => {
  expect(asText(150)).toBe('150');
  expect(asText(37.5)).toBe('37,5');
  expect(parseNumber(asText(0.6))).toBe(0.6);
});
