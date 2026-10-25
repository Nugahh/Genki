import { collection, doc, onSnapshot, setDoc, Timestamp, updateDoc, type Firestore } from '@react-native-firebase/firestore';
import type { FoodRepository } from '../application/ports';
import type { Food, FoodInput } from '../domain/food';

/** Custom foods in `users/{uid}/foods`. */
export function firestoreFoodRepository(db: Firestore, uid: string): FoodRepository {
  const foods = collection(db, 'users', uid, 'foods');
  const fields = (food: FoodInput) => ({
    name: food.name, state: food.state, per100g: food.per100g, portions: food.portions, updatedAt: Timestamp.now(),
  });

  return {
    create: (food) => setDoc(doc(foods), { ...fields(food), deletedAt: null }),
    update: (id, food) => updateDoc(doc(foods, id), fields(food)),
    remove: (id) => updateDoc(doc(foods, id), { deletedAt: Timestamp.now() }),
    observeAll(onNext, onError) {
      return onSnapshot(
        foods,
        (snapshot) =>
          onNext(
            snapshot.docs
              .filter((d) => d.data().deletedAt === null)
              .map((d): Food => ({ ref: { type: 'custom', id: d.id }, name: d.data().name, state: d.data().state, per100g: d.data().per100g, portions: d.data().portions })),
          ),
        onError,
      );
    },
  };
}
