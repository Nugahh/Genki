import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, SegmentedButtons } from 'react-native-paper';
import type { Profile } from '@/modules/settings';
import type { Clock } from '@/shared/clock';
import type { FoodUseCases } from '../application/foodUseCases';
import type { MealUseCases } from '../application/mealUseCases';
import type { ProductSearch } from '../application/productSearch';
import type { Food, FoodInput } from '../domain/food';
import type { Meal } from '../domain/meal';
import { FavoritesList } from './FavoritesList';
import { FoodDetail } from './FoodDetail';
import { FoodForm } from './FoodForm';
import { FoodSearch, type Search } from './FoodSearch';
import { RecentsList } from './RecentsList';
import { ScanScreen, type ScanCamera } from './ScanScreen';
import { useBrandProducts } from './useBrandProducts';
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
  /** The products of brands (Open Food Facts). */
  products: ProductSearch;
  /** The camera that reads the barcode of a product. */
  camera: ScanCamera;
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
export function AddFoodScreen({ meal, meals, foods, products, camera, profile, clock, pickWhen, run, onDone }: Props) {
  const [segment, setSegment] = useState<Segment>('search');
  // The food whose fiche replaces the segments, with the quantity to start from when it comes from « Récents ».
  // A product of a brand that is not one of the user's foods yet has no reference.
  const [selected, setSelected] = useState<{ food: Food | FoodInput; grams?: number } | null>(null);
  const [search, setSearch] = useState<Search>({ query: '' });
  // The scan takes the place of the lists; a barcode it could not find a product for is kept for the form that creates the food.
  const [scanning, setScanning] = useState(false);
  const [scanned, setScanned] = useState<string | undefined>();
  // Held here, not by the list: the products of a search are not asked again when the user comes back from a fiche. Raw or cooked leaves them out.
  const brand = useBrandProducts(products, search.query, !search.state && !search.quiet);
  // The custom foods, live: the search, the recents and the favorites all look foods up in them. null until the first list.
  const [custom, setCustom] = useState<Food[] | null>(null);
  // Listener errors show on the SyncIcon, which watches the same user's data.
  useEffect(() => foods.observeCustom(setCustom, () => {}), [foods]);

  const create = (food: FoodInput) => {
    run(() => foods.create(food));
    // The name is put in the field to show the food just created: it is not something the user typed, so it is not sent to Open Food Facts.
    setSearch({ query: food.name, quiet: true });
    setSegment('search');
    setScanned(undefined);
  };

  return (
    // Its own key for the sheet: the scroll offset of the lists must not carry over to it.
    <ScrollView key={selected ? 'sheet' : scanning ? 'scan' : 'lists'} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      {selected ? (
        <FoodDetail
          food={selected.food}
          grams={selected.grams}
          meal={meal}
          meals={meals}
          foods={foods}
          custom={custom ?? []}
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
      ) : scanning ? (
        <ScanScreen
          camera={camera}
          foods={foods}
          products={products}
          custom={custom ?? []}
          onFound={(choice) => {
            setScanning(false);
            setSelected({ food: 'food' in choice ? choice.food : choice.product });
          }}
          onCreate={(barcode) => {
            setScanning(false);
            setScanned(barcode);
            setSegment('create');
          }}
          onBack={() => setScanning(false)}
        />
      ) : (
        <>
          <View style={styles.segments}>
            {ROWS.map((buttons, i) => (
              <SegmentedButtons key={i} value={segment} onValueChange={setSegment} buttons={buttons} />
            ))}
          </View>
          <Button mode="outlined" icon="barcode-scan" contentStyle={styles.scan} onPress={() => setScanning(true)}>
            Scanner un code-barres
          </Button>
          {segment === 'favorites' && <FavoritesList meal={meal} meals={meals} foods={foods} custom={custom} run={run} onDone={onDone} />}
          {segment === 'recents' && <RecentsList meals={meals} foods={foods} custom={custom} onPick={(food, grams) => setSelected({ food, grams })} />}
          {segment === 'search' && <FoodSearch foods={foods} custom={custom} brand={brand} search={search} onSearch={setSearch} onSelect={(choice) => setSelected({ food: 'food' in choice ? choice.food : choice.product })} />}
          {segment === 'create' && <FoodForm submitLabel="Enregistrer" barcode={scanned} onSubmit={create} />}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({ content: { padding: 16, gap: 16 }, segments: { gap: 8 }, scan: { minHeight: 48 } });
