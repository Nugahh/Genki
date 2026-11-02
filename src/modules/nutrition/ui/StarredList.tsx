import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, HelperText, List, Text } from 'react-native-paper';
import type { FoodUseCases } from '../application/foodUseCases';
import type { StarredFoodUseCases } from '../application/starredFoods';
import type { Food, StarredFood } from '../domain/food';

type Props = {
  stars: StarredFoodUseCases;
  foods: FoodUseCases;
  /** The custom foods a star is looked up in; null until the first list arrives. */
  custom: Food[] | null;
  onPick: (food: Food) => void;
  /** Runs a write; a rejected one is offered again with « Réessayer » (spec §8). */
  run: (write: () => Promise<void>) => void;
};

/** The foods with a star (« Favoris »), by name; touching one opens its fiche. */
export function StarredList({ stars, foods, custom, onPick, run }: Props) {
  // null until the first list arrives, so that the empty line is never a guess.
  const [list, setList] = useState<StarredFood[] | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  // The star of a food that does not exist any more, offered to be taken off.
  const [gone, setGone] = useState<StarredFood | null>(null);
  // Listener errors show on the SyncIcon, which watches the same user's data.
  useEffect(() => stars.observe(setList, () => {}), [stars]);

  const open = async (star: StarredFood) => {
    const { ref } = star;
    if (custom === null) return; // the rows are disabled until then
    setProblem(null);
    setGone(null);
    const food = await foods.resolve(ref, custom).catch((error) => {
      console.warn(error);
      return null; // the lookup failed (the Ciqual database did not open), which is not the same as a food that is gone
    });
    if (food) return onPick(food);
    if (food === null) return setProblem('Recherche indisponible.');
    setProblem('Cet aliment n’existe plus.');
    setGone(star);
  };

  return (
    <View>
      {list?.length === 0 && <Text accessibilityLiveRegion="polite">Touche l’étoile sur la fiche d’un aliment pour le retrouver ici.</Text>}
      {problem && (
        <HelperText type="error" accessibilityLiveRegion="polite">
          {problem}
        </HelperText>
      )}
      {gone && (
        <Button
          compact
          icon="star-off-outline"
          contentStyle={styles.button}
          onPress={() => {
            run(() => stars.unstar(gone.ref));
            setGone(null);
            setProblem(null);
          }}
        >
          {`Retirer ${gone.name} des favoris`}
        </Button>
      )}
      {list?.map((star) => (
        <List.Item
          key={`${star.ref.type}:${star.ref.id}`}
          title={star.name}
          titleNumberOfLines={2}
          right={(props) => <List.Icon {...props} icon="star" />}
          accessibilityLabel={`${star.name}, favori`}
          disabled={custom === null}
          onPress={() => void open(star)}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({ button: { minHeight: 48 } });
