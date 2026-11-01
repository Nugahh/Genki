import { referencesFor } from './references';

const man = { sex: 'male', age: 30 } as const;
const woman = { sex: 'female', age: 30 } as const;

test('an adult has the ANSES reference of their sex', () => {
  expect(referencesFor(man, 2200)).toMatchObject({ vitA: 750, vitC: 110, magnesium: 420, zinc: 11.7, fiber: 30, salt: 5, sugars: 100, potassium: 3510 });
  expect(referencesFor(woman, 2200)).toMatchObject({ vitA: 650, vitC: 110, magnesium: 360, zinc: 9.3, vitB3: 14, copper: 1 });
});

test('the calcium reference drops from 1 000 to 950 mg at 25', () => {
  expect(referencesFor({ sex: 'male', age: 24 }, 2200).calcium).toBe(1000);
  expect(referencesFor({ sex: 'male', age: 25 }, 2200).calcium).toBe(950);
});

test('saturated fat is 12 % of the energy goal, in grams', () => {
  expect(referencesFor(man, 2200).saturatedFat).toBe(29.3);
  expect(referencesFor(man, 1800).saturatedFat).toBe(24);
});

test('every one of the 26 nutrients has a reference for an adult', () => {
  expect(Object.keys(referencesFor(man, 2200))).toHaveLength(26);
});

test('there is no reference under 18, or when the age is not known', () => {
  expect(referencesFor({ sex: 'male', age: 17 }, 2200)).toEqual({});
  expect(referencesFor({ sex: 'female', age: Number.NaN }, 2200)).toEqual({});
});

test('no energy goal, no saturated fat reference', () => {
  expect(referencesFor(man, Number.NaN).saturatedFat).toBeUndefined();
});
