import { StyleSheet, View } from 'react-native';
import { Icon, Surface, Text, TouchableRipple, useTheme } from 'react-native-paper';
import type { MetricView } from '../application/trackingUseCases';
import type { MetricDefinition } from '../domain/metric';
import type { Period } from '../domain/period';
import { MiniCurve } from './MiniCurve';

const BEFORE: Record<Period, string> = { day: 'la veille', week: 'la semaine précédente', year: 'l’année précédente' };

type Props = { def: MetricDefinition; period: Period; view: MetricView | null; onPress: () => void };

/** A statistic on the hub: its number over the period, how it moved since the one before, its shape. Touch to open it. */
export function MetricCard({ def, period, view, onPress }: Props) {
  const { colors } = useTheme();
  const value = view?.headline;
  const change = view?.change;
  const valueText = value === undefined ? undefined : def.format(value);
  const changeText = change === undefined ? undefined : change === 0 ? 'Inchangé' : `${change > 0 ? '+' : '−'}${def.format(Math.abs(change))}`;
  const spoken = [
    def.label,
    valueText ?? (view ? 'pas encore de mesure' : 'chargement'),
    change === undefined ? undefined : change === 0 ? `inchangé par rapport à ${BEFORE[period]}` : `${change > 0 ? 'plus' : 'moins'} ${def.format(Math.abs(change))} par rapport à ${BEFORE[period]}`,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <Surface mode="flat" elevation={1} style={styles.card}>
      <TouchableRipple testID={`card-${def.id}`} onPress={onPress} accessibilityRole="button" accessibilityLabel={spoken} accessibilityHint="Ouvre le détail" style={styles.touch}>
        <View style={styles.row}>
          <View style={styles.text}>
            <Text variant="titleMedium">{def.label}</Text>
            {view && (
              <Text variant="headlineSmall" style={valueText === undefined && { color: colors.onSurfaceVariant }}>
                {valueText ?? 'Pas encore de mesure'}
              </Text>
            )}
            {changeText && (
              <Text variant="bodyMedium" style={{ color: colors.onSurfaceVariant }}>
                {changeText}
              </Text>
            )}
          </View>
          {view && <MiniCurve points={view.points} tint={def.tint} />}
          <Icon source="chevron-right" size={24} color={colors.onSurfaceVariant} />
        </View>
      </TouchableRipple>
    </Surface>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 16 },
  // The ripple is clipped to the card here: a Surface with overflow hidden loses its shadow.
  touch: { padding: 16, minHeight: 48, borderRadius: 16, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  text: { flex: 1, gap: 2 },
});
