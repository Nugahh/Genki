import { useApp } from '@/appContext';
import { SyncIcon } from '@/modules/today';

/** The sync cloud at the top right of every tab header. */
export function HeaderSync() {
  const { app, writeFailed } = useApp();
  return <SyncIcon dayTotals={app.dayTotals} clock={app.clock} timezone={app.profile.timezone} writeFailed={writeFailed} />;
}
