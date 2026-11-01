import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SegmentedButtons } from 'react-native-paper';
import type { Profile } from '@/modules/settings';
import type { Clock } from '@/shared/clock';
import type { FoodUseCases } from '../application/foodUseCases';
import type { MealUseCases } from '../application/mealUseCases';
import type { Food, FoodInput } from '../domain/food';
import type { Meal } from '../domain/meal';
import { FavoritesList } from './FavoritesList';
import { FoodDetail } from './FoodDetail';
import { FoodForm } from './FoodForm';
import { FoodSearch, type Search } from './FoodSearch';
import { RecentsList } from './RecentsList';
import type { PickWhen } from './WhenPicker';

type Segment = 'favorites' | 'recents' | 'search' | 'create';

// Paper's segments are 40 dp tall: 4 dp more above and below the label make the 48 dp target. The check tells the chosen one by more than its tint.
const option = (value: Segment, label: string) => ({ value, label, labelStyle: { paddingVertical: 4 }, showSelectedCheck: true });
const SEGMENTS = [option('favorites', 'Favoris'), option('recents', 'Récents'), option('search', 'Recherche'), option('create', 'Créer')];
// Two rows of two: four in a row left « Recherche » 1 or 2 dp of room on a 360 dp phone, none for the selected check or a larger system font.
const ROWS = [SEGMENTS.slice(0, 2), SEGMENTS.slice(2)];

type Props = {
  /** The meal the food is added to. */
  meal: Meal;
  meals: MealUseCases;
  foods: FoodUseCases;
  /** The goals, the zone and the references of the sheet of a food. */
  profile: Profile;
  clock: Clock;
  /** The native picker of a date or a time. */
  pickWhen: PickWhen;
  /** Runs a write; a rejected one is offered again with « Réessayer » (spec §8). */
  run: (write: () => Promise<void>) => void;
  /** A food was added: the host leaves the screen. */
  onDone: () => void;
};

/** Adds a food to a meal: from a favorite, a recent, the search, or a food created on the spot. */
export function AddFoodScreen({ meal, meals, foods, profile, clock, pickWhen, run, onDone }: Props) {
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
          profile={profile}
          clock={clock}
          pickWhen={pickWhen}
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
          <View style={styles.segments}>
            {ROWS.map((buttons, i) => (
              <SegmentedButtons key={i} value={segment} onValueChange={setSegment} buttons={buttons} />
            ))}
          </View>
          {segment === 'favorites' && <FavoritesList meal={meal} meals={meals} foods={foods} custom={custom} run={run} onDone={onDone} />}
          {segment === 'recents' && <RecentsList meals={meals} foods={foods} custom={custom} onPick={(food, grams) => setSelected({ food, grams })} />}
          {segment === 'search' && <FoodSearch foods={foods} custom={custom} search={search} onSearch={setSearch} onSelect={(food) => setSelected({ food })} />}
          {segment === 'create' && <FoodForm submitLabel="Enregistrer" onSubmit={create} />}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({ content: { padding: 16, gap: 16 }, segments: { gap: 8 } });
