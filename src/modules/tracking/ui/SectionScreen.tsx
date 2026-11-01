import { useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Chip, Icon, Surface, Text, useTheme } from 'react-native-paper';
import type { UiPrefs } from '@/modules/settings';
import { dayKey, type Clock } from '@/shared/clock';
import { useNow } from '@/shared/useNow';
import { metricsIn } from '../application/registry';
import type { MetricView, TrackingUseCases } from '../application/trackingUseCases';
import type { Goals, MetricDefinition, SectionId } from '../domain/metric';
import { bucketsFor, periodTitle, rangeOf, shiftAnchor, type Period } from '../domain/period';
import { BEFORE, signed } from './changeText';
import { PeriodPicker } from './PeriodPicker';
import { SeriesChart } from './SeriesChart';
import { resolveUi } from './resolveUi';
import { useMetricView } from './useMetricView';

type Props = {
  section: SectionId;
  /** The statistic to open on; the first of the section when missing or from another section. */
  metricId?: string;
  tracking: TrackingUseCases;
  goals: Goals;
  ui: UiPrefs;
  onUiChange: (next: UiPrefs) => void;
  clock: Clock;
  timezone: string;
  /** What is particular to the section (macros, glasses of the day, sessions), below the summary. */
  renderExtras?: (context: { period: Period; day: string; def: MetricDefinition; view: MetricView | null }) => ReactNode;
};

// A chip is 32 dp tall: 8 dp more above and below make the 48 dp target.
const HIT_SLOP = { top: 8, bottom: 8 };

/** One section of Suivi: the period and its arrows, the chips of its statistics, the chart with the goal, the summary, the extras of the section. */
export function SectionScreen({ section, metricId, tracking, goals, ui, onUiChange, clock, timezone, renderExtras }: Props) {
  const { colors } = useTheme();
  const today = dayKey(useNow(clock), timezone);
  const { period } = resolveUi(ui);
  // null is the period in progress: it follows the clock, so that a screen left open overnight moves on to the new day.
  const [picked, setPicked] = useState<string | null>(null);
  const anchor = picked ?? today;
  const defs = metricsIn(section);
  const [selected, setSelected] = useState(metricId);
  const def = defs.find((d) => d.id === selected) ?? defs[0];
  const { view, failed } = useMetricView(tracking, def, goals, period, anchor);

  const canGoForward = rangeOf(bucketsFor(period, shiftAnchor(period, anchor, 1))).from <= today;
  const hasData = view?.points.some((p) => p.value !== undefined) ?? false;
  const { summary } = view ?? {};
  // A week with only today in it has no finished day to sum up yet.
  const showSummary = period === 'day' || (summary?.daysCounted ?? 0) > 0;
  const title = periodTitle(period, anchor);
  const shift = (step: -1 | 1) => {
    const next = shiftAnchor(period, anchor, step);
    setPicked(rangeOf(bucketsFor(period, next)).to >= today ? null : next);
  };

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <PeriodPicker period={period} onPeriod={(next) => onUiChange({ period: next })} title={title} onShift={shift} canGoForward={canGoForward} />

      {defs.length > 1 && (
        <View style={styles.chips}>
          {defs.map((d) => (
            <Chip key={d.id} hitSlop={HIT_SLOP} selected={d.id === def.id} onPress={() => setSelected(d.id)}>
              {d.label}
            </Chip>
          ))}
        </View>
      )}

      {failed && (
        <Text variant="bodyLarge" accessibilityLiveRegion="polite" style={{ color: colors.error }}>
          Impossible de charger cette statistique.
        </Text>
      )}
      {view && !hasData && (
        <Surface mode="flat" elevation={1} style={styles.empty}>
          <Icon source="chart-line-variant" size={32} color={colors.onSurfaceVariant} />
          <Text variant="bodyLarge" accessibilityLiveRegion="polite" style={styles.emptyText}>
            {def.emptyHint}
          </Text>
        </Surface>
      )}
      {view && hasData && (
        <>
          <Surface mode="flat" elevation={1} style={styles.card}>
            <SeriesChart def={def} points={view.points} goal={view.goal} title={title} />
          </Surface>

          {showSummary && (
            <Surface mode="flat" elevation={1} style={styles.card} testID="summary">
              {period === 'day' ? (
                <>
                  <Row label="Valeur du jour" value={view.headline === undefined ? '—' : def.format(view.headline)} />
                  {view.change !== undefined && (
                    <Text variant="bodyLarge" style={{ color: colors.onSurfaceVariant }}>{`${signed(def, view.change)} par rapport ${BEFORE.day}`}</Text>
                  )}
                </>
              ) : (
                summary && (
                  <>
                    <Row label="Moyenne" value={summary.average === undefined ? '—' : def.format(summary.average)} />
                    {view.change !== undefined && <Row label="Variation" value={`${signed(def, view.change)} par rapport ${BEFORE[period]}`} />}
                    {def.target !== 'none' && <Row label="Dans la cible" value={`${summary.daysInTarget} sur ${summary.daysCounted}`} />}
                    {summary.best && <Row label="Meilleur jour" value={`${def.format(summary.best.value)} · ${periodTitle('day', summary.best.day)}`} />}
                  </>
                )
              )}
            </Surface>
          )}
        </>
      )}

      {renderExtras?.({ period, day: anchor, def, view })}
    </ScrollView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.row}>
      <Text variant="bodyLarge" style={{ color: colors.onSurfaceVariant }}>
        {label}
      </Text>
      <Text variant="titleMedium" style={styles.value}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 16 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  card: { padding: 16, gap: 8, borderRadius: 16 },
  empty: { padding: 24, gap: 12, borderRadius: 16, alignItems: 'center' },
  emptyText: { textAlign: 'center' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 },
  value: { flexShrink: 1, textAlign: 'right' },
});
