import { StyleSheet } from 'react-native';
import { Button } from 'react-native-paper';
import type { WaterContainer } from '@/modules/settings';

type Props = { containers: WaterContainer[]; onAdd: (ml: number) => void };

/** One-tap add buttons, one per container of the profile: the host gives them a row to share. */
export function WaterButtons({ containers, onAdd }: Props) {
  return (
    <>
      {containers.map((c) => (
        <Button
          key={c.label}
          mode="contained-tonal"
          icon="cup-water"
          onPress={() => onAdd(c.ml)}
          accessibilityLabel={`Ajouter ${c.ml} ml (${c.label})`}
          style={styles.grow}
          contentStyle={styles.button}
        >
          +{c.ml} ml
        </Button>
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  // The amounts share the row: wide targets, wrapping on a large font.
  grow: { flexGrow: 1 },
  button: { minHeight: 48 },
});
