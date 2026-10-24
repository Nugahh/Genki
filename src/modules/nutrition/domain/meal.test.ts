import { defaultMeal, MEALS } from './meal';

test('the four meals, in day order', () => {
  expect(MEALS).toEqual(['breakfast', 'lunch', 'dinner', 'snack']);
});

test.each([
  [3.9, 'snack'],
  [4, 'breakfast'],
  [10.4, 'breakfast'],
  [10.5, 'lunch'],
  [14.9, 'lunch'],
  [15, 'snack'],
  [17.9, 'snack'],
  [18, 'dinner'],
  [23.9, 'dinner'],
])('at %s h the default meal is %s', (hour, meal) => {
  expect(defaultMeal(hour)).toBe(meal);
});
