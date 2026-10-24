import type { FoodCatalog } from '../application/ports';
import { matchCustom, type Food } from '../domain/food';

/** FoodCatalog over a fixed list of foods, for tests: same matching as the custom foods. */
export function inMemoryFoodCatalog(foods: Food[]): FoodCatalog {
  return {
    async search(query, { state, limit = 30 } = {}) {
      return matchCustom(foods, query, state).slice(0, limit);
    },
    async get(id) {
      return foods.find((f) => f.ref.id === id);
    },
  };
}
