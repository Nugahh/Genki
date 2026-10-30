import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { SegmentedButtons } from 'react-native-paper';
import type { FoodUseCases } from '../application/foodUseCases';
import type { MealUseCases } from '../application/mealUseCases';
import type { Food, FoodInput } from '../domain/food';
import type { Meal } from '../domain/meal';
import { FavoritesList } from './FavoritesList';
import { FoodDetail } from './FoodDetail';
import { FoodForm } from './FoodForm';
import { FoodSearch, type Search } from './FoodSearch';
import { RecentsList } from './RecentsList';

type Segment = 'favorites' | 'recents' | 'search' | 'create';

// Paper's segments are 40 dp tall: 4 dp more above and below the label make the 48 dp target. They also pad a label by 16 dp
// on each side, which cuts « Recherche » short on a phone with four segments: the label takes 10 dp of that back.
const LABEL = { paddingVertical: 4, marginHorizontal: -10 };
const SEGMENTS: { value: Segment; label: string; labelStyle: typeof LABEL }[] = [
  { value: 'favorites', label: 'Favoris', labelStyle: LABEL },
  { value: 'recents', label: 'Récents', labelStyle: LABEL },
  { value: 'search', label: 'Recherche', labelStyle: LABEL },
  { value: 'create', label: 'Créer', labelStyle: LABEL },
];

type Props = {
  /** The meal the food is added to. */
  meal: Meal;
  meals: MealUseCases;
  foods: FoodUseCases;
  /** Runs a write; a rejected one is offered again with « Réessayer » (spec §8). */
  run: (write: () => Promise<void>) => void;
  /** A food was added: the host leaves the screen. */
  onDone: () => void;
};

/** Adds a food to a meal: from a favorite, a recent, the search, or a food created on the spot. */
export function AddFoodScreen({ meal, meals, foods, run, onDone }: Props) {
  const [segment, setSegment] = useState<Segment>('search');
  // The food whose fiche replaces the segments, with the quantity to start from when it comes from « Récents ».
  const [selected, setSelected] = useState<{ food: Food; grams?: number } | null>(null);
  const [search, setSearch] = useState<Search>({ query: '' });
  // The custom foods, live: the search, the recents and the favorites all look foods up in them. null until the first list.
  const [custom, setCustom] = useState<Food[] | null>(null);
  // Listener errors show on the SyncIcon, which watches the same user's data.
  useEffect(() => foods.observeCustom(setCustom, () => {}), [foods]);

  const create = (food: FoodInput) => {
    run(() => foods.create(food));
    setSearch({ query: food.name });
    setSegment('search');
  };

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      {selected ? (
        <FoodDetail
          food={selected.food}
          grams={selected.grams}
          meal={meal}
          meals={meals}
          foods={foods}
          run={run}
          onDone={onDone}
          onBack={() => setSelected(null)}
          onRemoved={() => {
            setSelected(null);
            setSegment('search');
          }}
        />
      ) : (
        <>
          <SegmentedButtons value={segment} onValueChange={setSegment} buttons={SEGMENTS} />
          {segment === 'favorites' && <FavoritesList meal={meal} meals={meals} foods={foods} custom={custom} run={run} onDone={onDone} />}
          {segment === 'recents' && <RecentsList meals={meals} foods={foods} custom={custom} onPick={(food, grams) => setSelected({ food, grams })} />}
          {segment === 'search' && <FoodSearch foods={foods} custom={custom} search={search} onSearch={setSearch} onSelect={(food) => setSelected({ food })} />}
          {segment === 'create' && <FoodForm submitLabel="Enregistrer" onSubmit={create} />}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({ content: { padding: 16, gap: 16 } });
