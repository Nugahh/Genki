import * as DocumentPicker from 'expo-document-picker';
import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

/** Removes the backups an earlier export left in the cache: they hold the whole account in clear text. */
function clearOldBackups() {
  for (const entry of new Directory(Paths.cache).list()) {
    if (entry instanceof File && /^genki-.*\.json$/.test(entry.name)) entry.delete();
  }
}

/**
 * Writes a text file in the cache and opens the share sheet on it (Drive, Files, mail…). The file is not deleted right after: on Android
 * the sheet returns as soon as it is open, and the app chosen reads the file later. The next export clears it.
 */
export async function shareTextFile(name: string, text: string): Promise<void> {
  clearOldBackups();
  const file = new File(Paths.cache, name);
  file.create({ overwrite: true });
  file.write(text);
  if (!(await Sharing.isAvailableAsync())) throw new Error('Le partage n’est pas disponible sur cet appareil.');
  await Sharing.shareAsync(file.uri, { mimeType: 'application/json', dialogTitle: 'Exporter mes données' });
}

/** Lets the user pick a JSON file and returns its text, then deletes the copy the picker made in the cache; null when they cancel. */
export async function pickTextFile(): Promise<string | null> {
  const result = await DocumentPicker.getDocumentAsync({ type: ['application/json', 'text/plain'], copyToCacheDirectory: true });
  if (result.canceled) return null;
  const copy = new File(result.assets[0].uri);
  try {
    return await copy.text();
  } finally {
    copy.delete();
  }
}
