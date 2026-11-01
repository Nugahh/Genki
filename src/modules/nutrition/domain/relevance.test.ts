import { relevance } from './relevance';

const score = relevance;

test('a name that starts with the search beats a word that starts with it, which beats a name that contains it', () => {
  const starts = score('riz', 'Riz blanc, cru');
  const word = score('riz', 'Pain de riz complet');
  const inside = score('riz', 'Brizzi');
  expect(starts).toBeGreaterThan(word);
  expect(word).toBeGreaterThan(inside);
  expect(inside).toBeGreaterThan(0);
});

test('accents, case and the hyphen do not matter', () => {
  expect(score('COCA cola', 'Coca-Cola')).toBeGreaterThan(score('coca cola', 'Soda au cola, coca')); // the phrase at the start wins
  expect(score('creme', 'Crème fraîche')).toBeGreaterThan(0);
});

test('the brand answers too: « coca » finds the can of Zéro of Coca-Cola, below a name that starts with it', () => {
  const zero = score('coca', 'Zéro sucres', 'Coca-Cola');
  expect(zero).toBeGreaterThan(0);
  expect(score('coca', 'Coca-Cola', 'Coca-Cola')).toBeGreaterThan(zero);
});

test('every term has to be somewhere, in the name or in the brand', () => {
  expect(score('coca fanta', 'Coca-Cola', 'Coca-Cola')).toBe(0);
  expect(score('coca zero', 'Zéro sucres', 'Coca-Cola')).toBeGreaterThan(0);
});

test('a shorter name comes before a longer one that matches the same way', () => {
  expect(score('riz', 'Riz soufflé')).toBeGreaterThan(score('riz', 'Riz blanc, cuit, sans sel ajouté'));
});

test('an empty search matches nothing', () => {
  expect(score('  ', 'Riz')).toBe(0);
});
