import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { HelperText, List, Text } from 'react-native-paper';
import type { FoodUseCases } from '../application/foodUseCases';
import type { MealUseCases } from '../application/mealUseCases';
import type { Food, RecentFood } from '../domain/food';
import { gramsText } from './format';

type Props = {
  meals: MealUseCases;
  foods: FoodUseCases;
  /** The custom foods a recent is looked up in; null until the first list arrives. */
  custom: Food[] | null;
  /** The recent food is found: open it with the quantity eaten last time. */
  onPick: (food: Food, grams: number) => void;
};

/** The foods eaten lately, each with its last quantity. */
export function RecentsList({ meals, foods, custom, onPick }: Props) {
  // null until the first list arrives, so that « Aucun aliment récent. » is never a guess.
  const [recents, setRecents] = useState<RecentFood[] | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  // Listener errors show on the SyncIcon, which watches the same user's data.
  useEffect(() => meals.observeRecent(setRecents, () => {}), [meals]);

  const open = async ({ ref, grams }: RecentFood) => {
    if (custom === null) return; // the rows are disabled until then
    const food = await foods.resolve(ref, custom).catch((error) => {
      console.warn(error);
      return null; // the lookup failed (the Ciqual database did not open), which is not the same as a food that is gone
    });
    if (food) onPick(food, grams);
    else setProblem(food === null ? 'Recherche indisponible.' : 'Cet aliment n’existe plus.');
  };

  return (
    <View>
      {recents?.length === 0 && <Text accessibilityLiveRegion="polite">Aucun aliment récent. Cherche un aliment ou scanne un code-barres.</Text>}
      {problem && (
        <HelperText type="error" accessibilityLiveRegion="polite">
          {problem}
        </HelperText>
      )}
      {recents?.map((recent) => (
        <List.Item
          key={`${recent.ref.type}:${recent.ref.id}`}
          title={recent.name}
          titleNumberOfLines={2}
          description={`${gramsText(recent.grams)} g`}
          disabled={custom === null}
          onPress={() => void open(recent)}
        />
      ))}
    </View>
  );
}
