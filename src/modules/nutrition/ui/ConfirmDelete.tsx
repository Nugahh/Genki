import { ConfirmDialog } from '@/shared/ConfirmDialog';

type Props = { title: string; onCancel: () => void; onConfirm: () => void };

/** « Supprimer … ? » for what cannot come back (a deleted document is never restored): it asks first. */
export const ConfirmDelete = (props: Props) => <ConfirmDialog {...props} confirmLabel="Supprimer" />;
