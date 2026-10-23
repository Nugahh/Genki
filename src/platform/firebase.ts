import { getApp } from '@react-native-firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithCredential,
  type User,
} from '@react-native-firebase/auth';
import { CACHE_SIZE_UNLIMITED, initializeFirestore } from '@react-native-firebase/firestore';
import { GoogleSignin, isSuccessResponse } from '@react-native-google-signin/google-signin';
import Constants from 'expo-constants';
import { useEffect, useState } from 'react';

// Offline persistence is on by default natively; the data is tiny, so the cache never evicts (spec §8).
export const db = initializeFirestore(getApp(), { cacheSizeBytes: CACHE_SIZE_UNLIMITED });

GoogleSignin.configure({ webClientId: Constants.expoConfig?.extra?.googleWebClientId });

export async function signInWithGoogle(): Promise<void> {
  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  const response = await GoogleSignin.signIn();
  if (!isSuccessResponse(response)) return; // the account picker was closed
  const { idToken } = response.data;
  if (!idToken) throw new Error('Google n’a pas renvoyé de jeton : vérifiez le client Web dans google-services.');
  await signInWithCredential(getAuth(), GoogleAuthProvider.credential(idToken));
}

/** The signed-in user, or null. React Native Firebase restores the session synchronously at startup, offline too. */
export function useAuthUser(): User | null {
  const [user, setUser] = useState(() => getAuth().currentUser);
  useEffect(() => onAuthStateChanged(getAuth(), setUser), []);
  return user;
}
