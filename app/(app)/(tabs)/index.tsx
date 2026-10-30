import { useApp } from '@/appContext';
import { TodayScreen } from '@/modules/today';

export default function Today() {
  const { app, run } = useApp();
  return (
    <TodayScreen profile={app.profile} clock={app.clock} dayTotals={app.dayTotals} hydration={app.hydration} run={run} />
  );
}
