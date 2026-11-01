import { collection, doc, onSnapshot, setDoc, Timestamp, updateDoc, type Firestore } from '@react-native-firebase/firestore';
import type { FoodRepository } from '../application/ports';
import type { Food, FoodInput } from '../domain/food';

/** Custom foods in `users/{uid}/foods`. */
export function firestoreFoodRepository(db: Firestore, uid: string): FoodRepository {
  const foods = collection(db, 'users', uid, 'foods');
  // The extras of a product of Open Food Facts are written only when the food has them (the SDK refuses an undefined field).
  const fields = (food: FoodInput) => ({
    name: food.name, state: food.state, per100g: food.per100g, portions: food.portions, updatedAt: Timestamp.now(),
    ...(food.nutrients && { nutrients: food.nutrients }),
    ...(food.source && { source: food.source }),
    ...(food.brand && { brand: food.brand }),
    ...(food.barcode && { barcode: food.barcode }),
  });

  return {
    add(food) {
      const ref = doc(foods);
      return { id: ref.id, written: setDoc(ref, { ...fields(food), deletedAt: null }) };
    },
    update: (id, food) => updateDoc(doc(foods, id), fields(food)),
    remove: (id) => updateDoc(doc(foods, id), { deletedAt: Timestamp.now() }),
    observeAll(onNext, onError) {
      return onSnapshot(
        foods,
        (snapshot) =>
          onNext(
            snapshot.docs
              .filter((d) => d.data().deletedAt === null)
              .map((d): Food => {
                const data = d.data();
                return {
                  ref: { type: 'custom', id: d.id }, name: data.name, state: data.state, per100g: data.per100g, portions: data.portions,
                  ...(data.nutrients && { nutrients: data.nutrients }),
                  ...(data.source && { source: data.source }),
                  ...(data.brand && { brand: data.brand }),
                  ...(data.barcode && { barcode: data.barcode }),
                };
              }),
          ),
        onError,
      );
    },
  };
}
