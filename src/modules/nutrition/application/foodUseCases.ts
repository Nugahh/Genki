import type { Food, FoodInput, FoodRef } from '../domain/food';
import { validateFood } from '../domain/food';
import type { FoodCatalog, FoodRepository } from './ports';

export function foodUseCases(deps: { catalog: FoodCatalog; repo: FoodRepository }) {
  const { catalog, repo } = deps;
  const checked = (food: FoodInput): FoodInput => {
    const problem = validateFood(food);
    if (problem) throw new Error(problem);
    return { ...food, name: food.name.trim(), portions: food.portions.map((p) => ({ ...p, label: p.label.trim() })) };
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
      return repo.add(checked(food)).write();
    },
    /**
     * Uses a product of Open Food Facts as a food of one's own: the one the user already has for its barcode, else a new one. Its reference is
     * known at once, for the line of the journal; `write` saves the food (nothing to save for one the user has), and can be run again on a retry.
     */
    adopt(product: FoodInput, custom: Food[]): { food: Food; write: () => Promise<void> } {
      const existing = product.barcode ? custom.find((f) => f.barcode === product.barcode) : undefined;
      if (existing) return { food: existing, write: () => Promise.resolve() };
      const valid = checked(product);
      const { id, write } = repo.add(valid);
      return { food: { ref: { type: 'custom', id }, ...valid }, write };
    },
    /** The food of one's own with this barcode, from the live list the caller holds. */
    findByBarcode: (code: string, custom: Food[]) => custom.find((f) => f.barcode === code),
    async update(id: string, food: FoodInput) {
      return repo.update(id, checked(food));
    },
    async remove(id: string) {
      return repo.remove(id);
    },
  };
}

export type FoodUseCases = ReturnType<typeof foodUseCases>;
