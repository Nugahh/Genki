import { collection, deleteDoc, doc, onSnapshot, setDoc, Timestamp, type Firestore } from '@react-native-firebase/firestore';
import type { FavoriteMealRepository } from '../application/ports';
import type { FavoriteMeal } from '../domain/food';

/** Favorite meals ("repas types") in `users/{uid}/favoriteMeals`. */
export function firestoreFavoriteMealRepository(db: Firestore, uid: string): FavoriteMealRepository {
  const meals = collection(db, 'users', uid, 'favoriteMeals');

  return {
    create: (meal) => setDoc(doc(meals), { name: meal.name, items: meal.items, updatedAt: Timestamp.now() }),
    remove: (id) => deleteDoc(doc(meals, id)),
    observeAll(onNext, onError) {
      return onSnapshot(
        meals,
        (snapshot) => onNext(snapshot.docs.map((d): FavoriteMeal => ({ id: d.id, name: d.data().name, items: d.data().items }))),
        onError,
      );
    },
  };
}
