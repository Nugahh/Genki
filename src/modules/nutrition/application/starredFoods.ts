import type { FoodRef, StarredFood } from '../domain/food';
import type { StarredFoodRepository } from './ports';

const byName = (a: StarredFood, b: StarredFood) => a.name.localeCompare(b.name, 'fr');
const same = (a: FoodRef, b: FoodRef) => a.type === b.type && a.id === b.id;

/** The foods marked with a star (« Favoris »): one star a food, by name. */
export function starredFoodUseCases(repo: StarredFoodRepository) {
  return {
    observe(onNext: (list: StarredFood[]) => void, onError: (error: Error) => void) {
      return repo.observeAll((list) => onNext([...list].sort(byName)), onError);
    },
    async star(food: StarredFood) {
      const name = food.name.trim();
      // A use case does not trust its caller (the rules bound the name too).
      if (name === '' || name.length > 200) throw new Error('Le nom de l’aliment doit faire entre 1 et 200 caractères.');
      return repo.add({ ref: food.ref, name });
    },
    async unstar(ref: FoodRef) {
      return repo.remove(ref);
    },
    isStarred: (list: StarredFood[], ref: FoodRef) => list.some((f) => same(f.ref, ref)),
  };
}

export type StarredFoodUseCases = ReturnType<typeof starredFoodUseCases>;
