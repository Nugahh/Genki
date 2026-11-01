import { validateUi } from './ui';

test('accepts empty preferences, and a list of metrics with a period', () => {
  expect(validateUi({})).toBeNull();
  expect(validateUi({ hubMetrics: ['calories', 'water'], period: 'year' })).toBeNull();
  expect(validateUi({ period: 'month' })).toBeNull();
  expect(validateUi({ hubMetrics: [] })).toBeNull();
});

test.each([
  ['31 metrics', { hubMetrics: Array.from({ length: 31 }, (_, i) => `m${i}`) }],
  ['a duplicate', { hubMetrics: ['calories', 'calories'] }],
  ['a blank id', { hubMetrics: [' '] }],
  ['an id of 41 characters', { hubMetrics: ['x'.repeat(41)] }],
  ['a period that is not one', { period: 'quarter' as never }],
])('refuses %s with a message', (_, ui) => {
  expect(validateUi(ui)).toEqual(expect.stringMatching(/\S/));
});

test('names the periods that exist', () => {
  expect(validateUi({ period: 'quarter' as never })).toBe('La période doit être le jour, la semaine, le mois ou l’année.');
});
