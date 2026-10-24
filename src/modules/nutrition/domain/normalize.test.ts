import { normalizeSearch } from './normalize';

test.each([
  ['Œuf à la coque', 'oeuf a la coque'],
  ['Pomme de terre, sans peau, crue', 'pomme de terre sans peau crue'],
  ["Boeuf, steak haché 5% MG cuit", 'boeuf steak hache 5 mg cuit'],
  ['  Crème   brûlée  ', 'creme brulee'],
  ['', ''],
])('%s → %s', (input, expected) => {
  expect(normalizeSearch(input)).toBe(expected);
});
