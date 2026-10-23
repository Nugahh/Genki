import { act, render, screen } from '@testing-library/react-native';
import { PaperProvider } from 'react-native-paper';
import type { DayTotalsRepository } from '../application/ports';
import { SyncIcon } from './SyncIcon';

const clock = { now: () => new Date('2026-10-23T13:00:00Z') };

// Day totals driven by hand: the test plays the snapshots.
let onNext: Parameters<DayTotalsRepository['observe']>[1];
let onError: Parameters<DayTotalsRepository['observe']>[2];
const dayTotals: DayTotalsRepository = {
  observe: (_day, next, error) => {
    onNext = next;
    onError = error;
    return () => {};
  },
};

const renderIcon = (writeFailed: boolean) =>
  render(
    <PaperProvider>
      <SyncIcon dayTotals={dayTotals} clock={clock} timezone="Europe/Paris" writeFailed={writeFailed} />
    </PaperProvider>,
  );

test('the cloud follows the snapshot metadata of the day totals', async () => {
  await renderIcon(false);
  expect(screen.getByLabelText('Hors-ligne')).toBeTruthy();
  await act(() => onNext({ waterMl: 0 }, { hasPendingWrites: true, fromCache: true }));
  expect(screen.getByLabelText('En attente d’envoi')).toBeTruthy();
  await act(() => onNext({ waterMl: 0 }, { hasPendingWrites: false, fromCache: false }));
  expect(screen.getByLabelText('Synchronisé')).toBeTruthy();
  await act(() => onError(new Error('denied')));
  expect(screen.getByLabelText('Erreur de synchronisation')).toBeTruthy();
});

test('a failed write shows the error cloud', async () => {
  await renderIcon(true);
  expect(screen.getByLabelText('Erreur de synchronisation')).toBeTruthy();
});
