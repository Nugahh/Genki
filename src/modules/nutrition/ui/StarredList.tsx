import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { HelperText, Icon, List, Text } from 'react-native-paper';
import type { FoodUseCases } from '../application/foodUseCases';
import type { StarredFoodUseCases } from '../application/starredFoods';
import type { Food, StarredFood } from '../domain/food';

type Props = {
  stars: StarredFoodUseCases;
  foods: FoodUseCases;
  /** The custom foods a star is looked up in; null until the first list arrives. */
  custom: Food[] | null;
  onPick: (food: Food) => void;
};

/** The foods with a star (« Favoris »), by name; touching one opens its fiche. */
export function StarredList({ stars, foods, custom, onPick }: Props) {
  // null until the first list arrives, so that the empty line is never a guess.
  const [list, setList] = useState<StarredFood[] | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  // Listener errors show on the SyncIcon, which watches the same user's data.
  useEffect(() => stars.observe(setList, () => {}), [stars]);

  const open = async ({ ref }: StarredFood) => {
    if (custom === null) return; // the rows are disabled until then
    setProblem(null);
    const food = await foods.resolve(ref, custom).catch((error) => {
      console.warn(error);
      return null; // the lookup failed (the Ciqual database did not open), which is not the same as a food that is gone
    });
    if (food) onPick(food);
    else setProblem(food === null ? 'Recherche indisponible.' : 'Cet aliment n’existe plus.');
  };

  return (
    <View>
      {list?.length === 0 && <Text accessibilityLiveRegion="polite">Touche l’étoile sur la fiche d’un aliment pour le retrouver ici.</Text>}
      {problem && (
        <HelperText type="error" accessibilityLiveRegion="polite">
          {problem}
        </HelperText>
      )}
      {list?.map((star) => (
        <List.Item
          key={`${star.ref.type}:${star.ref.id}`}
          title={star.name}
          titleNumberOfLines={2}
          right={(props) => <Icon source="star" size={24} color={props.color} />}
          accessibilityLabel={`${star.name}, favori`}
          disabled={custom === null}
          onPress={() => void open(star)}
        />
      ))}
    </View>
  );
}
