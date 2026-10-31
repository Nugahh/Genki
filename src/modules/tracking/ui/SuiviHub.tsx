import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button } from 'react-native-paper';
import type { UiPrefs } from '@/modules/settings';
import { dayKey, type Clock } from '@/shared/clock';
import { useNow } from '@/shared/useNow';
import type { TrackingUseCases } from '../application/trackingUseCases';
import type { MetricDefinition, SectionId } from '../domain/metric';
import { metricById } from '../domain/metrics';
import { periodTitle } from '../domain/period';
import { HubEditor } from './HubEditor';
import { MetricCard } from './MetricCard';
import { PeriodPicker } from './PeriodPicker';
import { resolveUi } from './resolveUi';
import { useMetricView } from './useMetricView';

type Props = {
  tracking: TrackingUseCases;
  ui: UiPrefs;
  onUiChange: (next: UiPrefs) => void;
  clock: Clock;
  timezone: string;
  onOpen: (section: SectionId, metricId: string) => void;
};

// shortcut: each card listens on its own; share one read if the hub grows beyond a handful of cards.
function HubCard({ tracking, def, period, today, onOpen }: { tracking: TrackingUseCases; def: MetricDefinition; period: ReturnType<typeof resolveUi>['period']; today: string; onOpen: Props['onOpen'] }) {
  const view = useMetricView(tracking, def, period, today);
  return <MetricCard def={def} period={period} view={view} onPress={() => onOpen(def.section, def.id)} />;
}

/** The Suivi hub: one card per statistic over the period, which is chosen here; « Modifier » changes which cards and in which order. */
export function SuiviHub({ tracking, ui, onUiChange, clock, timezone, onOpen }: Props) {
  const today = dayKey(useNow(clock), timezone);
  const { hubMetrics, period } = resolveUi(ui);
  const [editing, setEditing] = useState(false);

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <PeriodPicker period={period} onPeriod={(next) => onUiChange({ period: next })} title={periodTitle(period, today)} />
      <View style={styles.actions}>
        <Button icon="pencil" contentStyle={styles.button} onPress={() => setEditing(true)}>
          Modifier
        </Button>
      </View>
      {hubMetrics.map((id) => (
        <HubCard key={id} tracking={tracking} def={metricById(id)!} period={period} today={today} onOpen={onOpen} />
      ))}
      {editing && <HubEditor shown={hubMetrics} onChange={(next) => onUiChange({ hubMetrics: next })} onClose={() => setEditing(false)} />}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 12 },
  actions: { alignItems: 'flex-end' },
  button: { minHeight: 48 },
});
