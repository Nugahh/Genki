import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Icon, Surface, Text, useTheme } from 'react-native-paper';
import type { UiPrefs } from '@/modules/settings';
import type { Clock } from '@/shared/clock';
import type { AppTheme } from '@/theme';
import type { MicroRow, TrackingUseCases } from '../application/trackingUseCases';
import type { Goals, Tone } from '../domain/metric';
import type { Period } from '../domain/period';
import { PeriodPicker } from './PeriodPicker';
import { nutrientPeriod, resolveUi } from './resolveUi';
import { useMicronutrients } from './useMicronutrients';
import { usePeriodAnchor } from './usePeriodAnchor';

type Props = {
  tracking: TrackingUseCases;
  goals: Goals;
  ui: UiPrefs;
  onUiChange: (next: UiPrefs) => void;
  clock: Clock;
  timezone: string;
  /** The period to open on (the day, from the journal) until another is chosen; the preference stays untouched. */
  startOn?: Period;
  /** A nutrient was touched: show its chart. */
  onOpen: (id: string) => void;
};

const NO_YEAR = ['day', 'week', 'month'] as const;
const STATES: Record<'reach' | 'limit', Record<Tone, string>> = {
  reach: { good: 'dans la cible', warn: 'proche de la cible', bad: 'loin de la cible', none: '' },
  limit: { good: 'sous la limite', warn: 'un peu au-dessus de la limite', bad: 'au-dessus de la limite', none: '' },
};
const SECTIONS = [
  { title: 'À atteindre', groups: [{ id: 'vitamins', title: 'Vitamines' }, { id: 'minerals', title: 'Minéraux' }, { id: 'fiber', title: 'Fibres' }] },
  { title: 'À limiter', groups: [{ id: 'limit', title: undefined }] },
];

/** What a screen reader says of a row: the amount, the share of the reference and where it stands, in words (never the colour alone). */
function spoken(row: MicroRow) {
  const { info, def, value, incomplete, pct, tone } = row;
  if (value === undefined) return `${info.label}, aucune donnée`;
  const state = STATES[info.group === 'limit' ? 'limit' : 'reach'][tone];
  return [info.label, `${incomplete ? 'au moins ' : ''}${def.format(value)}`, pct !== undefined && `${pct} % du repère`, state, incomplete && 'valeur partielle'].filter(Boolean).join(', ');
}

/** The vitamins, minerals, fibre and the nutrients to limit over a day, a week or a month, against the reference intakes of the profile. */
export function MicronutrientsScreen({ tracking, goals, ui, onUiChange, clock, timezone, startOn, onOpen }: Props) {
  const { colors } = useTheme<AppTheme>();
  const [started, setStarted] = useState(startOn);
  const period = started ?? nutrientPeriod(resolveUi(ui).period);
  const { anchor, title, canGoForward, shift } = usePeriodAnchor(period, clock, timezone);
  const { rows, failed } = useMicronutrients(tracking, goals, period, anchor);
  const hasData = rows?.some((r) => r.value !== undefined) ?? false;
  const hasReferences = Object.keys(goals.nutrients ?? {}).length > 0;
  const paint: Record<Tone, string> = { good: colors.pace.green, warn: colors.pace.orange, bad: colors.pace.red, none: colors.outline };

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <PeriodPicker period={period} onPeriod={(next) => {
          setStarted(undefined);
          onUiChange({ period: next });
        }} title={title} onShift={shift} canGoForward={canGoForward} periods={[...NO_YEAR]} />
      <Text variant="bodyMedium" style={{ color: colors.onSurfaceVariant }}>
        {period === 'day' ? 'Total du jour' : 'Moyenne par jour, sur les jours terminés'}
      </Text>

      {failed && (
        <Text variant="bodyLarge" accessibilityLiveRegion="polite" style={{ color: colors.error }}>
          Impossible de charger les micronutriments.
        </Text>
      )}
      {rows && !hasData && (
        <Surface mode="flat" elevation={1} style={styles.empty}>
          <Icon source="leaf" size={32} color={colors.onSurfaceVariant} />
          <Text variant="bodyLarge" accessibilityLiveRegion="polite" style={styles.emptyText}>
            Ajoute un aliment de la table Ciqual pour voir tes vitamines et minéraux.
          </Text>
        </Surface>
      )}
      {rows && hasData &&
        SECTIONS.map((section) => (
          <View key={section.title} style={styles.section}>
            <Text variant="titleLarge" accessibilityRole="header">
              {section.title}
            </Text>
            {section.groups.map((group) => (
              <View key={group.id} style={styles.group}>
                {group.title && (
                  <Text variant="titleSmall" accessibilityRole="header" style={{ color: colors.onSurfaceVariant }}>
                    {group.title}
                  </Text>
                )}
                {rows
                  .filter((r) => r.info.group === group.id)
                  .map((r) => (
                    <Pressable key={r.info.id} accessibilityRole="button" accessibilityLabel={spoken(r)} style={styles.row} onPress={() => onOpen(r.info.id)}>
                      <View style={styles.line}>
                        <Text variant="bodyLarge" style={styles.name}>
                          {r.info.label}
                        </Text>
                        <Text variant="bodyLarge" style={styles.amount}>
                          {r.value === undefined ? '—' : `${r.incomplete ? 'au moins ' : ''}${r.def.format(r.value)}`}
                        </Text>
                        <Text variant="titleMedium" style={styles.pct}>
                          {r.pct === undefined ? '' : `${r.pct} %`}
                        </Text>
                      </View>
                      {r.incomplete && r.value !== undefined && (
                        <Text variant="labelSmall" style={{ color: colors.onSurfaceVariant }}>
                          partiel
                        </Text>
                      )}
                      <View style={[styles.track, { backgroundColor: colors.surfaceVariant }]}>
                        <View style={{ width: `${Math.min(r.pct ?? 0, 100)}%`, height: 6, borderRadius: 3, backgroundColor: paint[r.tone] }} />
                      </View>
                    </Pressable>
                  ))}
              </View>
            ))}
          </View>
        ))}

      {rows && hasData && !hasReferences && (
        <Text variant="bodyMedium" style={{ color: colors.onSurfaceVariant }}>
          Les repères de l’ANSES sont donnés pour les adultes de 18 ans et plus.
        </Text>
      )}
      <Text variant="bodySmall" style={{ color: colors.onSurfaceVariant }}>
        Repères de l’ANSES pour adultes. Ce n’est pas un avis médical.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 16 },
  section: { gap: 8 },
  group: { gap: 4 },
  // 48 dp is the touch target of a row.
  row: { minHeight: 48, justifyContent: 'center', gap: 4, paddingVertical: 4 },
  line: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  name: { flex: 1 },
  amount: { flexShrink: 1, textAlign: 'right' },
  pct: { minWidth: 56, textAlign: 'right' },
  track: { height: 6, borderRadius: 3 },
  empty: { padding: 24, gap: 12, borderRadius: 16, alignItems: 'center' },
  emptyText: { textAlign: 'center' },
});
