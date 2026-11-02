import type { StarredFoodRepository } from '../application/ports';
import type { FoodRef, StarredFood } from '../domain/food';

const key = (ref: FoodRef) => `${ref.type}_${ref.id}`;

/** StarredFoodRepository kept in memory, for tests. */
export function inMemoryStarredFoodRepository(): StarredFoodRepository {
  let stars = new Map<string, StarredFood>();
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach((listener) => listener());
  return {
    async add(food) {
      stars = new Map(stars).set(key(food.ref), food);
      notify();
    },
    async remove(ref) {
      stars = new Map([...stars].filter(([k]) => k !== key(ref)));
      notify();
    },
    observeAll(onNext) {
      const listener = () => onNext([...stars.values()]);
      listeners.add(listener);
      listener();
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
