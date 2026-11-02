import { useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { Button, Surface, Text, useTheme } from 'react-native-paper';
import { ConfirmDialog } from '@/shared/ConfirmDialog';
import type { DataUseCases } from '../application/dataUseCases';

type Props = {
  data: DataUseCases;
  files: {
    /** Offers a text file to share. */
    share: (name: string, text: string) => Promise<void>;
    /** Lets the user pick a file; null when they cancel. */
    pick: () => Promise<string | null>;
  };
};

type Busy = 'export' | 'import' | 'totals' | null;
type Message = { text: string; error?: boolean };
type Pending = { kind: 'import'; text: string; documents: number } | { kind: 'totals' };

const reason = (error: unknown) => (error instanceof Error ? error.message : 'L’opération a échoué, réessaie.');
const plural = (n: number, one: string, many: string) => `${n} ${n >= 2 ? many : one}`;

/** Settings › Données (spec §8): export the account to a JSON file, restore one, rebuild the totals of the days. */
export function DataScreen({ data, files }: Props) {
  const { colors } = useTheme();
  const [busy, setBusy] = useState<Busy>(null);
  const [message, setMessage] = useState<Message | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);

  const attempt = async (kind: Exclude<Busy, null>, work: () => Promise<Message | null>) => {
    setBusy(kind);
    setMessage(null);
    try {
      setMessage(await work());
    } catch (error) {
      setMessage({ text: reason(error), error: true });
    } finally {
      setBusy(null);
    }
  };

  const exportAll = () =>
    attempt('export', async () => {
      const { name, text } = await data.exportBackup();
      await files.share(name, text);
      return { text: 'Sauvegarde exportée.' };
    });

  const chooseFile = () =>
    attempt('import', async () => {
      const text = await files.pick();
      if (text === null) return null;
      setPending({ kind: 'import', text, documents: data.previewBackup(text).documents });
      return null;
    });

  const restore = (text: string) =>
    attempt('import', async () => {
      const { written, failed, firstError } = await data.importBackup(text);
      return failed === 0
        ? { text: `${plural(written, 'document restauré', 'documents restaurés')}.` }
        : { text: `${plural(written, 'document restauré', 'documents restaurés')}, ${plural(failed, 'refusé', 'refusés')} : ${firstError}`, error: true };
    });

  const recompute = () =>
    attempt('totals', async () => {
      const { days, corrected } = await data.recomputeTotals();
      return { text: corrected === 0 ? `Les totaux de ${plural(days, 'jour', 'jours')} étaient justes.` : `${plural(corrected, 'jour corrigé', 'jours corrigés')} sur ${days}.` };
    });

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Surface mode="flat" elevation={1} style={styles.card}>
        <Text variant="titleMedium" accessibilityRole="header">
          Sauvegarde
        </Text>
        <Text variant="bodyMedium" style={{ color: colors.onSurfaceVariant }}>
          Un fichier JSON avec tout ton compte, à garder sur Drive ou dans Fichiers. Il est fait pour restaurer un compte vide : l’importer remplace ton profil et les jours, aliments, repas, favoris et programmes de mêmes identifiants.
        </Text>
        <Button mode="contained-tonal" icon="export-variant" contentStyle={styles.button} disabled={busy !== null} loading={busy === 'export'} onPress={() => void exportAll()}>
          Exporter mes données
        </Button>
        <Button mode="outlined" icon="import" contentStyle={styles.button} disabled={busy !== null} loading={busy === 'import'} onPress={() => void chooseFile()}>
          Importer une sauvegarde
        </Button>
      </Surface>

      <Surface mode="flat" elevation={1} style={styles.card}>
        <Text variant="titleMedium" accessibilityRole="header">
          Totaux
        </Text>
        <Text variant="bodyMedium" style={{ color: colors.onSurfaceVariant }}>
          Si un total du jour te semble faux (deux téléphones ont modifié le même repas hors-ligne), il se reconstruit à partir des repas et des verres.
        </Text>
        <Button mode="outlined" icon="calculator-variant-outline" contentStyle={styles.button} disabled={busy !== null} loading={busy === 'totals'} onPress={() => setPending({ kind: 'totals' })}>
          Recalculer les totaux
        </Button>
      </Surface>

      {message && (
        <Text variant="bodyLarge" accessibilityLiveRegion="polite" style={{ color: message.error ? colors.error : colors.onSurface }}>
          {message.text}
        </Text>
      )}

      {pending?.kind === 'import' && (
        <ConfirmDialog
          title={`Importer ${plural(pending.documents, 'document', 'documents')} ?`}
          confirmLabel="Importer"
          onCancel={() => setPending(null)}
          onConfirm={() => {
            const { text } = pending;
            setPending(null);
            void restore(text);
          }}
        />
      )}
      {pending?.kind === 'totals' && (
        <ConfirmDialog
          title="Recalculer les totaux de tous les jours ?"
          confirmLabel="Recalculer"
          onCancel={() => setPending(null)}
          onConfirm={() => {
            setPending(null);
            void recompute();
          }}
        />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 16 },
  card: { padding: 16, gap: 12, borderRadius: 16 },
  button: { minHeight: 48 },
});
