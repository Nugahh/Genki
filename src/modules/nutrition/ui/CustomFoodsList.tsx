import { StyleSheet, View } from 'react-native';
import { Button, List, Text } from 'react-native-paper';
import type { Food } from '../domain/food';
import { foodLine } from './format';
import { StateChip } from './StateChip';

type Props = {
  /** The foods of the user; null until the first list arrives. */
  custom: Food[] | null;
  onPick: (food: Food) => void;
  onCreate: () => void;
};

const byName = (a: Food, b: Food) => a.name.localeCompare(b.name, 'fr');

/** The foods of the user, by name, under the button that creates one. */
export function CustomFoodsList({ custom, onPick, onCreate }: Props) {
  return (
    <View style={styles.list}>
      <Button mode="contained-tonal" icon="plus" contentStyle={styles.button} onPress={onCreate}>
        Créer un aliment
      </Button>
      {custom?.length === 0 && <Text accessibilityLiveRegion="polite">Aucun aliment à toi pour l’instant. Crée-en un avec le bouton ci-dessus.</Text>}
      {[...(custom ?? [])].sort(byName).map((food) => (
        <List.Item
          key={food.ref.id}
          title={food.name}
          titleNumberOfLines={2}
          description={foodLine(food)}
          descriptionNumberOfLines={2}
          right={({ style }) => (food.source === 'off' ? <Text variant="labelSmall" style={[style, styles.source]}>Open Food Facts</Text> : <StateChip state={food.state} style={style} />)}
          onPress={() => onPick(food)}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 8 },
  button: { minHeight: 48 },
  source: { alignSelf: 'center' },
});
