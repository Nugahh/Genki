import { StyleSheet, View } from 'react-native';
import { Text, TouchableRipple, useTheme } from 'react-native-paper';

type Props = {
  tabs: { key: string; label: string }[];
  value: string;
  onChange: (key: string) => void;
};

/**
 * A row of Material tabs that share the width: the open one has its label in the ink of the text and a 3 dp line under it, the others the soft ink.
 * It is the same ink as the text, not the accent: the line and the state announced to a screen reader tell the open tab, not a color alone.
 */
export function Tabs({ tabs, value, onChange }: Props) {
  const { colors } = useTheme();
  return (
    // Not `accessible`: that would make the row one stop for a screen reader instead of one per tab.
    <View testID="tabs" accessibilityRole="tablist" style={styles.row}>
      {tabs.map(({ key, label }) => {
        const selected = key === value;
        return (
          <TouchableRipple key={key} accessibilityRole="tab" accessibilityState={{ selected }} style={styles.tab} onPress={() => onChange(key)}>
            <View style={styles.content}>
              {/* One line that shrinks to fit: « Personnalisé » is 83 dp at the normal size and does not fit a third of 360 dp at 1.3× or more. */}
              <Text variant="labelLarge" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} style={[styles.label, { color: selected ? colors.onSurface : colors.onSurfaceVariant }]}>
                {label}
              </Text>
              <View testID={`tab-indicator-${key}`} style={[styles.line, { backgroundColor: selected ? colors.onSurface : 'transparent' }]} />
            </View>
          </TouchableRipple>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row' },
  tab: { flex: 1, minHeight: 48 },
  // The whole tab, so that the line stays on the bottom of the row whatever its neighbours do.
  content: { flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  label: { textAlign: 'center' },
  line: { position: 'absolute', left: 8, right: 8, bottom: 0, height: 3, borderTopLeftRadius: 3, borderTopRightRadius: 3 },
});
