import { collection, doc, onSnapshot, serverTimestamp, setDoc, Timestamp, writeBatch, type Firestore } from '@react-native-firebase/firestore';
import type { Device, StepsRepository } from '../application/ports';

/** The steps of `users/{uid}/days/{date}` (merged next to the totals) and the devices of `users/{uid}/devices`. */
export function firestoreStepsRepository(db: Firestore, uid: string): StepsRepository {
  const days = collection(db, 'users', uid, 'days');
  const devices = collection(db, 'users', uid, 'devices');

  return {
    saveDay: (day, { steps, source, syncedAt }) =>
      setDoc(doc(days, day), { steps, stepsSource: source, stepsSyncedAt: Timestamp.fromDate(syncedAt), updatedAt: serverTimestamp() }, { merge: true }),

    observeDevices(onNext, onError) {
      return onSnapshot(
        devices,
        (snapshot) =>
          onNext(
            snapshot.docs.map((d): Device => {
              const data = d.data();
              return { id: d.id, name: typeof data.name === 'string' ? data.name : d.id, stepsWriter: data.stepsWriter === true, lastStepsSyncAt: data.lastStepsSyncAt?.toDate() };
            }),
            // An empty list from the cache says nothing about the server's: it is not « no device yet ».
            !(snapshot.empty && snapshot.metadata.fromCache),
          ),
        onError,
      );
    },

    touchDevice: (id, name, syncedAt) => setDoc(doc(devices, id), { name, ...(syncedAt && { lastStepsSyncAt: Timestamp.fromDate(syncedAt) }) }, { merge: true }),

    setWriter(id, name, othersToClear) {
      const batch = writeBatch(db);
      for (const other of othersToClear) batch.set(doc(devices, other), { stepsWriter: false }, { merge: true });
      batch.set(doc(devices, id), { name, stepsWriter: true }, { merge: true });
      return batch.commit();
    },
  };
}
