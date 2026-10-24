import type { Food, FoodInput, FoodRef } from '../domain/food';
import { validateFood } from '../domain/food';
import type { FoodCatalog, FoodRepository } from './ports';

export function foodUseCases(deps: { catalog: FoodCatalog; repo: FoodRepository }) {
  const { catalog, repo } = deps;
  const checked = (food: FoodInput): FoodInput => {
    const problem = validateFood(food);
    if (problem) throw new Error(problem);
    return { ...food, name: food.name.trim() };
  };

  return {
    async searchCatalog(query: string, state?: 'raw' | 'cooked') {
      return catalog.search(query, { state });
    },
    /** A food by reference: Ciqual from the catalog, a custom one from the live list the caller holds. */
    async resolve(ref: FoodRef, custom: Food[]): Promise<Food | undefined> {
      return ref.type === 'ciqual' ? catalog.get(ref.id) : custom.find((f) => f.ref.id === ref.id);
    },
    observeCustom: repo.observeAll,
    async create(food: FoodInput) {
      return repo.create(checked(food));
    },
    async update(id: string, food: FoodInput) {
      return repo.update(id, checked(food));
    },
    async remove(id: string) {
      return repo.remove(id);
    },
  };
}

export type FoodUseCases = ReturnType<typeof foodUseCases>;
