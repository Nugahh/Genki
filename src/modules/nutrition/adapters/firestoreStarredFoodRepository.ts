import { collection, deleteDoc, doc, onSnapshot, setDoc, Timestamp, type Firestore } from '@react-native-firebase/firestore';
import type { StarredFoodRepository } from '../application/ports';
import type { FoodRef, StarredFood } from '../domain/food';

// One document a food, named after it: starring a food again rewrites the same document. The rules check the name against the reference.
const keyOf = (ref: FoodRef) => `${ref.type}_${ref.id}`;

/** The foods with a star, in `users/{uid}/starredFoods`. */
export function firestoreStarredFoodRepository(db: Firestore, uid: string): StarredFoodRepository {
  const stars = collection(db, 'users', uid, 'starredFoods');

  return {
    add: (food) => setDoc(doc(stars, keyOf(food.ref)), { foodRef: food.ref, foodName: food.name, updatedAt: Timestamp.now() }),
    remove: (ref) => deleteDoc(doc(stars, keyOf(ref))),
    observeAll(onNext, onError) {
      return onSnapshot(
        stars,
        (snapshot) => onNext(snapshot.docs.map((d): StarredFood => ({ ref: d.data().foodRef, name: d.data().foodName }))),
        onError,
      );
    },
  };
}
