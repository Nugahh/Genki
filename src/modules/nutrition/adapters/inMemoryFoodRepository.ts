import type { FoodRepository } from '../application/ports';
import type { Food, FoodInput } from '../domain/food';

/** FoodRepository kept in memory, for tests. */
export function inMemoryFoodRepository(): FoodRepository {
  let nextId = 1;
  let foods: Food[] = [];
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach((listener) => listener());

  return {
    add(food: FoodInput) {
      const id = String(nextId++);
      return {
        id,
        write: async () => {
          foods = [...foods.filter((f) => f.ref.id !== id), { ref: { type: 'custom', id }, ...food }];
          notify();
        },
      };
    },
    async update(id: string, food: FoodInput) {
      foods = foods.map((f) => (f.ref.id === id ? { ref: { type: 'custom', id }, ...food } : f));
      notify();
    },
    async remove(id: string) {
      foods = foods.filter((f) => f.ref.id !== id);
      notify();
    },
    observeAll(onNext: (foods: Food[]) => void) {
      const listener = () => onNext(foods);
      listeners.add(listener);
      listener();
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
