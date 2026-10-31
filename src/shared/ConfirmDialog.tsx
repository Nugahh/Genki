import { StyleSheet } from 'react-native';
import { Button, Dialog, Portal } from 'react-native-paper';

type Props = { title: string; confirmLabel: string; onCancel: () => void; onConfirm: () => void };

/** A question that must interrupt, with the action named on its button: « Supprimer », « Remplacer ». The host mounts it while it is open. */
export function ConfirmDialog({ title, confirmLabel, onCancel, onConfirm }: Props) {
  return (
    <Portal>
      <Dialog visible onDismiss={onCancel}>
        <Dialog.Title>{title}</Dialog.Title>
        <Dialog.Actions>
          <Button contentStyle={styles.button} onPress={onCancel}>
            Annuler
          </Button>
          <Button contentStyle={styles.button} onPress={onConfirm}>
            {confirmLabel}
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}

const styles = StyleSheet.create({ button: { minHeight: 48 } });
