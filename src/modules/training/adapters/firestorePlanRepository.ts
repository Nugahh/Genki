import { collection, doc, onSnapshot, setDoc, Timestamp, type Firestore } from '@react-native-firebase/firestore';
import type { PlanRepository } from '../application/ports';
import type { NewPlan, Plan } from '../domain/plan';

/** Programmes in `users/{uid}/plans`: one document per programme, its phases inside. */
export function firestorePlanRepository(db: Firestore, uid: string): PlanRepository {
  const plans = collection(db, 'users', uid, 'plans');
  const data = (plan: NewPlan) => ({ name: plan.name, active: plan.active, startDay: plan.startDay, phases: plan.phases, updatedAt: Timestamp.now() });

  return {
    create: (plan) => setDoc(doc(plans), data(plan)),
    update: (plan) => setDoc(doc(plans, plan.id), data(plan)),
    observeAll(onNext, onError) {
      return onSnapshot(
        plans,
        (snapshot) =>
          onNext(snapshot.docs.map((d): Plan => ({ id: d.id, name: d.data().name, active: d.data().active, startDay: d.data().startDay, phases: d.data().phases }))),
        onError,
      );
    },
  };
}
