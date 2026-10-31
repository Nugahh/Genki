import { router } from 'expo-router';
import { useApp } from '@/appContext';
import { SportScreen } from '@/modules/training';

export default function Sport() {
  const { app, run } = useApp();
  return (
    <SportScreen
      profile={app.profile}
      clock={app.clock}
      training={app.training}
      run={run}
      onStart={(session) => router.push({ pathname: '/workout', params: { session: String(session) } })}
      onEditPlan={() => router.push('/plan')}
    />
  );
}
