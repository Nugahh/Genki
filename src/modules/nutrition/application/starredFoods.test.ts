import { inMemoryStarredFoodRepository } from '../adapters/inMemoryStarredFoodRepository';
import type { StarredFood } from '../domain/food';
import { starredFoodUseCases } from './starredFoods';

const rice: StarredFood = { ref: { type: 'ciqual', id: '9100' }, name: 'Riz blanc, cru' };
const oats: StarredFood = { ref: { type: 'ciqual', id: '9300' }, name: 'Flocons d’avoine' };
const own: StarredFood = { ref: { type: 'custom', id: 'c1' }, name: 'Whey ESN' };

function setup() {
  const stars = starredFoodUseCases(inMemoryStarredFoodRepository());
  let list: StarredFood[] = [];
  stars.observe((next) => (list = next), () => {});
  return { stars, list: () => list };
}

test('a starred food is listed', async () => {
  const { stars, list } = setup();
  await stars.star(rice);
  expect(list()).toEqual([rice]);
});

test('the list is by name, accents and case ignored', async () => {
  const { stars, list } = setup();
  await stars.star(own);
  await stars.star(oats);
  await stars.star(rice);
  expect(list().map((f) => f.name)).toEqual(['Flocons d’avoine', 'Riz blanc, cru', 'Whey ESN']);
});

test('starring twice is one star', async () => {
  const { stars, list } = setup();
  await stars.star(rice);
  await stars.star(rice);
  expect(list()).toHaveLength(1);
});

test('a food of Ciqual and a food of the user with the same id are two foods', async () => {
  const { stars, list } = setup();
  await stars.star({ ref: { type: 'ciqual', id: '1' }, name: 'A' });
  await stars.star({ ref: { type: 'custom', id: '1' }, name: 'B' });
  expect(list()).toHaveLength(2);
});

test('unstarring takes it out, and unstarring what is not starred does nothing', async () => {
  const { stars, list } = setup();
  await stars.star(rice);
  await stars.star(oats);
  await stars.unstar(rice.ref);
  await stars.unstar(own.ref);
  expect(list()).toEqual([oats]);
});

test('isStarred looks a reference up in the list', () => {
  const { stars } = setup();
  expect(stars.isStarred([rice, own], { type: 'custom', id: 'c1' })).toBe(true);
  expect(stars.isStarred([rice, own], { type: 'ciqual', id: 'c1' })).toBe(false);
});

test('refuses a name that is empty or longer than the rules allow, before any write', async () => {
  const { stars, list } = setup();
  await expect(stars.star({ ref: rice.ref, name: '  ' })).rejects.toThrow();
  await expect(stars.star({ ref: rice.ref, name: 'x'.repeat(201) })).rejects.toThrow();
  expect(list()).toEqual([]);
});
