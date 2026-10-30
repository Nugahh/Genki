import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { IconButton, List, Text } from 'react-native-paper';
import type { FoodUseCases } from '../application/foodUseCases';
import type { MealUseCases } from '../application/mealUseCases';
import type { FavoriteMeal, Food } from '../domain/food';
import type { Meal } from '../domain/meal';

type Props = {
  meal: Meal;
  meals: MealUseCases;
  foods: FoodUseCases;
  /** The custom foods a favorite's foods are looked up in; null until the first list arrives. */
  custom: Food[] | null;
  run: (write: () => Promise<void>) => void;
  onDone: () => void;
};

/** The saved meals: a touch adds all their foods to the meal, the bin forgets one. */
export function FavoritesList({ meal, meals, foods, custom, run, onDone }: Props) {
  // null until the first list arrives, so that « Aucun favori. » is never a guess.
  const [favorites, setFavorites] = useState<FavoriteMeal[] | null>(null);
  // Listener errors show on the SyncIcon, which watches the same user's data.
  useEffect(() => meals.observeFavorites(setFavorites, () => {}), [meals]);

  // Set by the first touch of a row: a second one, before the host has left the screen, must not log the meal again.
  const submitted = useRef(false);

  const log = (favorite: FavoriteMeal) => {
    if (custom === null || submitted.current) return; // the rows are disabled until the custom foods have arrived
    submitted.current = true;
    run(() => meals.logFavorite(favorite, meal, (ref) => foods.resolve(ref, custom)));
    onDone();
  };

  return (
    <View>
      {favorites?.length === 0 && <Text>Aucun favori. Enregistrez un repas depuis le journal.</Text>}
      {favorites?.map((favorite) => (
        <View key={favorite.id} style={styles.row}>
          <List.Item
            style={styles.item}
            title={favorite.name}
            titleNumberOfLines={2}
            description={favorite.items.map((item) => item.foodName).join(', ')}
            disabled={custom === null}
            onPress={() => log(favorite)}
          />
          <IconButton
            icon="delete-outline"
            style={styles.iconButton}
            accessibilityLabel={`Supprimer le favori ${favorite.name}`}
            onPress={() => run(() => meals.removeFavorite(favorite.id))}
          />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  item: { flex: 1 },
  // Paper's icon button is 40 dp, and its container clips the extra hit area: 48 dp make the touch target.
  iconButton: { width: 48, height: 48, borderRadius: 24 },
});
