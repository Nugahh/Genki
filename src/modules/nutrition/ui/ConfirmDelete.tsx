import { StyleSheet } from 'react-native';
import { Button, Dialog, Portal } from 'react-native-paper';

type Props = { title: string; onCancel: () => void; onConfirm: () => void };

/** « Supprimer … ? » for what cannot come back (a deleted document is never restored): it asks first. */
export function ConfirmDelete({ title, onCancel, onConfirm }: Props) {
  return (
    <Portal>
      <Dialog visible onDismiss={onCancel}>
        <Dialog.Title>{title}</Dialog.Title>
        <Dialog.Actions>
          <Button contentStyle={styles.button} onPress={onCancel}>
            Annuler
          </Button>
          <Button contentStyle={styles.button} onPress={onConfirm}>
            Supprimer
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}

const styles = StyleSheet.create({ button: { minHeight: 48 } });
