import { View } from 'react-native';
import { useTheme } from 'react-native-paper';
import { GaugeRow } from '@/shared/GaugeRow';
import type { AppTheme } from '@/theme';
import { gramsText, kcalText } from './format';

// The icons of the Today gauges for the calories and the protein; a grain of wheat for the carbs, a drop of oil for the fat.
const ICONS = { calories: 'fire', protein: 'arm-flex', carbs: 'barley', fat: 'oil' } as const;

type Props = {
  metric: keyof typeof ICONS;
  label: string;
  value: number;
  goal: number;
  unit: 'kcal' | 'g';
};

/**
 * One macro of the day against its goal, in the layout of the Today gauges: « Énergie – 700 / 2 200 kcal » with the percentage at the right of that
 * line, and a bar under it. The bar is the hue of the macro, not a pace: a pace needs the hour of the day, and the day's macros need only the total.
 */
export function MacroGauge({ metric, label, value, goal, unit }: Props) {
  const { colors } = useTheme<AppTheme>();
  const progress = goal > 0 ? value / goal : 0;
  const percent = Math.round(progress * 100);
  const text = unit === 'kcal' ? kcalText : gramsText;

  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={`${label} : ${text(value)} sur ${text(goal)} ${unit}, ${percent} %${progress > 1 ? ', au-dessus de l’objectif' : ''}`}
      accessibilityValue={{ min: 0, max: 100, now: Math.min(percent, 100), text: `${percent} %` }}
    >
      <GaugeRow
        icon={ICONS[metric]}
        tint={colors.metric[metric]}
        badgeTestID={`macro-badge-${metric}`}
        title={`${label} – ${text(value)} / ${text(goal)} ${unit}`}
        progress={progress}
        fillColor={colors.chart[metric]}
      />
    </View>
  );
}
