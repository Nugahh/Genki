import { StyleSheet, View } from 'react-native';
import { Icon, Surface, Text, TouchableRipple, useTheme } from 'react-native-paper';
import type { Clock } from '@/shared/clock';
import type { QuitProfile, TobaccoUseCases } from '../application/tobaccoUseCases';
import { useTobaccoSummary } from './useTobaccoSummary';

type Props = { tobacco: TobaccoUseCases; profile: QuitProfile; clock: Clock; timezone: string; onOpen: () => void };

const euros = (n: number) => `${n.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} €`;
const days = (n: number) => `${n} jour${n >= 2 ? 's' : ''}`;

/** The days without tobacco and the record (spec §6); only once a quit date is set. A touch opens the section of the Suivi. */
export function TobaccoCard({ tobacco, profile, clock, timezone, onOpen }: Props) {
  const { colors } = useTheme();
  const summary = useTobaccoSummary(tobacco, profile, clock, timezone);
  if (!profile.quitDate || !summary) return null;

  const caption = [`Record : ${days(summary.record)}`, summary.savedEuros === undefined ? undefined : `${euros(summary.savedEuros)} économisés`].filter(Boolean).join(' · ');
  return (
    <Surface mode="flat" elevation={1} style={styles.card}>
      <TouchableRipple onPress={onOpen} accessibilityRole="button" accessibilityLabel={`Sans tabac, ${days(summary.current)}, ${caption}`} accessibilityHint="Ouvre le suivi du tabac" style={styles.touch}>
        <View style={styles.row}>
          <View style={[styles.badge, { backgroundColor: colors.secondaryContainer }]}>
            <Icon source="smoking-off" size={24} color={colors.onSecondaryContainer} />
          </View>
          <View style={styles.text}>
            <Text variant="bodyMedium" style={{ color: colors.onSurfaceVariant }}>
              Sans tabac
            </Text>
            <Text variant="headlineSmall">{days(summary.current)}</Text>
            <Text variant="bodyMedium" style={{ color: colors.onSurfaceVariant }}>
              {caption}
            </Text>
          </View>
          <Icon source="chevron-right" size={24} color={colors.onSurfaceVariant} />
        </View>
      </TouchableRipple>
    </Surface>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 16 },
  touch: { padding: 16, minHeight: 48, borderRadius: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  badge: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, gap: 2 },
});
