import type { FavoriteMealRepository } from '../application/ports';
import type { FavoriteMeal, NewFavoriteMeal } from '../domain/food';

/** FavoriteMealRepository kept in memory, for tests. */
export function inMemoryFavoriteMealRepository(): FavoriteMealRepository {
  let nextId = 1;
  let meals: FavoriteMeal[] = [];
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach((listener) => listener());

  return {
    async create(meal: NewFavoriteMeal) {
      meals = [...meals, { ...meal, id: String(nextId++) }];
      notify();
    },
    async remove(id: string) {
      meals = meals.filter((m) => m.id !== id);
      notify();
    },
    observeAll(onNext: (meals: FavoriteMeal[]) => void) {
      const listener = () => onNext(meals);
      listeners.add(listener);
      listener();
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
