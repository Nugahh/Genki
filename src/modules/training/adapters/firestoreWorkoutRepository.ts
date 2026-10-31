import {
  collection,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
  where,
  writeBatch,
  type Firestore,
  type QueryDocumentSnapshot,
} from '@react-native-firebase/firestore';
import type { WorkoutRepository } from '../application/ports';
import type { WorkoutLog } from '../domain/workout';

const logOf = (d: QueryDocumentSnapshot): WorkoutLog => {
  const data = d.data();
  return {
    id: d.id,
    day: data.day,
    planId: data.planId,
    sessionName: data.sessionName,
    exerciseIds: data.exerciseIds,
    sets: data.sets,
    durationMin: data.durationMin,
    createdAt: data.createdAt.toDate(),
  };
};

/** Workouts in `users/{uid}/workoutLogs`: written once, as done. */
export function firestoreWorkoutRepository(db: Firestore, uid: string): WorkoutRepository {
  const logs = collection(db, 'users', uid, 'workoutLogs');
  const milestones = collection(db, 'users', uid, 'milestones');

  // Spec §4 rule 6: `exerciseIds array-contains`, newest day first. It needs the composite index of firebase/firestore.indexes.json.
  const holding = (exerciseId: string, max: number) =>
    getDocs(query(logs, where('exerciseIds', 'array-contains', exerciseId), orderBy('day', 'desc'), limit(max))).then((snapshot) => snapshot.docs.map(logOf));

  return {
    add(log, reachedMilestoneIds = []) {
      const at = Timestamp.fromDate(log.createdAt);
      const batch = writeBatch(db);
      batch.set(doc(logs), {
        day: log.day,
        planId: log.planId,
        sessionName: log.sessionName,
        exerciseIds: log.exerciseIds,
        sets: log.sets,
        durationMin: log.durationMin,
        createdAt: at,
        deletedAt: null,
      });
      for (const id of reachedMilestoneIds) batch.update(doc(milestones, id), { achievedAt: at });
      return batch.commit();
    },
    latestWithExercise: (exerciseId) => holding(exerciseId, 1).then((found) => found[0]),
    history: holding,
    observeLatest(onNext, onError) {
      return onSnapshot(query(logs, orderBy('createdAt', 'desc'), limit(1)), (snapshot) => onNext(snapshot.docs.map(logOf)[0]), onError);
    },
  };
}
