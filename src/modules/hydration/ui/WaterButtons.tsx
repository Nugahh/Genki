import { StyleSheet, View } from 'react-native';
import { Button } from 'react-native-paper';
import type { WaterContainer } from '@/modules/settings';

type Props = { containers: WaterContainer[]; onAdd: (ml: number) => void };

/** One-tap add buttons, one per container of the profile. */
export function WaterButtons({ containers, onAdd }: Props) {
  return (
    <View style={styles.row}>
      {containers.map((c) => (
        <Button
          key={c.label}
          mode="contained-tonal"
          icon="cup-water"
          onPress={() => onAdd(c.ml)}
          accessibilityLabel={`Ajouter ${c.ml} ml (${c.label})`}
          contentStyle={styles.button}
        >
          +{c.ml} ml
        </Button>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  button: { minHeight: 48 },
});
