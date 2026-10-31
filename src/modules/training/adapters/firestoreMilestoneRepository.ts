import { collection, deleteDoc, doc, getDocs, onSnapshot, setDoc, type Firestore, type QueryDocumentSnapshot } from '@react-native-firebase/firestore';
import type { MilestoneRepository } from '../application/ports';
import type { Milestone } from '../domain/milestone';

const milestoneOf = (d: QueryDocumentSnapshot): Milestone => {
  const data = d.data();
  return { id: d.id, metric: data.metric, target: data.target, direction: data.direction, label: data.label, achievedAt: data.achievedAt?.toDate() };
};

/** Milestones (paliers) in `users/{uid}/milestones`. */
export function firestoreMilestoneRepository(db: Firestore, uid: string): MilestoneRepository {
  const milestones = collection(db, 'users', uid, 'milestones');

  return {
    create: (m) => setDoc(doc(milestones), { metric: m.metric, target: m.target, direction: m.direction, label: m.label }),
    remove: (id) => deleteDoc(doc(milestones, id)),
    list: () => getDocs(milestones).then((snapshot) => snapshot.docs.map(milestoneOf)),
    observeAll: (onNext, onError) => onSnapshot(milestones, (snapshot) => onNext(snapshot.docs.map(milestoneOf)), onError),
  };
}
