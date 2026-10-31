import * as Application from 'expo-application';
import { Platform } from 'react-native';

/** This phone, for the list of devices of the account: a stable id (the Android id of the app's signing key and user) and its model. */
export const thisDevice = {
  id: Application.getAndroidId(),
  name: (Platform.constants as { Model?: string }).Model ?? 'Android',
};
