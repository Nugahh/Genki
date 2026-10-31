import { Redirect, router, Stack, useLocalSearchParams } from 'expo-router';
import { useApp } from '@/appContext';
import { WaterDay } from '@/modules/hydration';
import { useUiPrefs } from '@/modules/settings';
import { goalsOf, NutritionExtras, sectionById, SectionScreen, TrainingExtras } from '@/modules/tracking';
import { useNextSession } from '@/modules/training';
import type { Period } from '@/modules/tracking';

/** The sessions of the week against the programme's: only this section reads the programme. */
function TrainingSection({ period, day }: { period: Period; day: string }) {
  const { app, profile } = useApp();
  const next = useNextSession(app.training, app.clock, app.profile.timezone);
  return <TrainingExtras tracking={app.tracking} goals={goalsOf(profile)} period={period} day={day} planned={next?.perWeek} onOpenSport={() => router.navigate('/sport')} />;
}

export default function SuiviSection() {
  const { section, metric } = useLocalSearchParams<{ section: string; metric?: string }>();
  const { app, profile, run } = useApp();
  const [ui, changeUi] = useUiPrefs(app.settings, run);
  const info = sectionById(section);
  if (!info) return <Redirect href="/suivi" />;
  if (!ui) return null; // the first snapshot is from the cache: no flash of defaults

  return (
    <>
      <Stack.Screen options={{ title: info.label }} />
      <SectionScreen
        // A new statistic asked for (from Today) starts a new screen: the chip chosen before must not win.
        key={`${info.id}-${metric}`}
        section={info.id}
        metricId={metric}
        tracking={app.tracking}
        goals={goalsOf(profile)}
        ui={ui}
        onUiChange={changeUi}
        clock={app.clock}
        timezone={app.profile.timezone}
        renderExtras={({ period, day, view }) => {
          if (info.id === 'nutrition') return <NutritionExtras split={view?.split} onOpenJournal={() => router.navigate('/repas')} />;
          if (info.id === 'eau') return period === 'day' ? <WaterDay hydration={app.hydration} day={day} timezone={app.profile.timezone} run={run} /> : null;
          if (info.id === 'entrainement') return <TrainingSection period={period} day={day} />;
          return null;
        }}
      />
    </>
  );
}
