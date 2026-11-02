import type { ReactNode } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { Icon, Text, useTheme } from 'react-native-paper';
import type { AppTheme } from '@/theme';
import { useFillAnimation } from './useFillAnimation';

type Props = {
  /** The icon of the measure, on a disc of its own tint. */
  icon: string;
  tint: { container: string; on: string };
  badgeTestID?: string;
  /** « Énergie – 0 / 2 079 kcal »: what is measured and where the day stands. */
  title: string;
  /** Progress toward the goal, from 0; past 1 the bar is full and the percentage says how far. */
  progress: number;
  fillColor: string;
  /** Where the day should be by now, from 0 to 1: a tick on the bar. */
  marker?: number;
  /** At the right end of the row (a plus, a chevron). */
  trailing?: ReactNode;
  /** Under the bar. */
  children?: ReactNode;
};

/**
 * The one layout of a measure against its goal, on Today and on Repas: the icon on its disc, then « Nom – valeur / objectif unité » with the percentage
 * at the right end of that line, then the bar under both. It says nothing of what is left: the figures and the percentage are enough.
 */
export function GaugeRow({ icon, tint, badgeTestID, title, progress, fillColor, marker, trailing, children }: Props) {
  const { colors } = useTheme<AppTheme>();
  const fill = useFillAnimation(progress);
  return (
    <View style={styles.row}>
      <View testID={badgeTestID} style={[styles.badge, { backgroundColor: tint.container }]}>
        <Icon source={icon} size={20} color={tint.on} />
      </View>
      <View style={styles.body}>
        <View testID="gauge-head" style={styles.head}>
          <Text variant="titleMedium" style={styles.title}>
            {title}
          </Text>
          <Text variant="labelLarge" style={[styles.percent, { color: colors.onSurfaceVariant }]}>{`${Math.round(progress * 100)} %`}</Text>
        </View>
        <View testID="gauge-track" style={[styles.track, { backgroundColor: colors.surfaceVariant }]}>
          <Animated.View style={[styles.fill, { width: fill.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }), backgroundColor: fillColor }]} />
          {marker !== undefined && (
            // Pulled back by its 2 dp width as it nears 100 %, or the track's overflow would clip it.
            <View testID="gauge-marker" style={[styles.marker, { backgroundColor: colors.onSurface, left: `${marker * 100}%`, marginLeft: -2 * marker }]} />
          )}
        </View>
        {children}
      </View>
      {trailing}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48 },
  badge: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, gap: 4 },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  // Tabular figures: the digits do not shift as the day's total grows.
  title: { flex: 1, fontVariant: ['tabular-nums'] },
  // Room for « 125 % » at a larger font, right-aligned so that the percentages line up from one gauge to the next.
  percent: { minWidth: 48, textAlign: 'right', fontVariant: ['tabular-nums'] },
  track: { height: 12, borderRadius: 6, overflow: 'hidden' },
  fill: { height: '100%' },
  marker: { position: 'absolute', top: 0, bottom: 0, width: 2 },
});
