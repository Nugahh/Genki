import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Button, Chip, Text } from 'react-native-paper';
import type { Profile } from '@/modules/settings';
import type { Clock } from '@/shared/clock';
import { Tabs } from '@/shared/Tabs';
import type { FoodUseCases } from '../application/foodUseCases';
import type { MealUseCases } from '../application/mealUseCases';
import type { ProductSearch } from '../application/productSearch';
import type { StarredFoodUseCases } from '../application/starredFoods';
import type { Food, FoodInput } from '../domain/food';
import type { Meal } from '../domain/meal';
import { CustomFoodsList } from './CustomFoodsList';
import { FavoritesList } from './FavoritesList';
import { FoodDetail } from './FoodDetail';
import { FoodForm } from './FoodForm';
import { FoodSearch, type Choice, type Search } from './FoodSearch';
import { ScanScreen, type ScanCamera } from './ScanScreen';
import { StarredList } from './StarredList';
import { useBrandProducts } from './useBrandProducts';
import type { PickWhen } from './WhenPicker';

type Tab = 'all' | 'starred' | 'custom';
type Kind = 'foods' | 'meals';

const TABS = [
  { key: 'all', label: 'Tout' },
  { key: 'starred', label: 'Favoris' },
  { key: 'custom', label: 'Personnalisé' },
];
// A chip is 32 dp tall: 8 dp more above and below make the 48 dp target.
const HIT_SLOP = { top: 8, bottom: 8 };

type Props = {
  /** The meal the food is added to. */
  meal: Meal;
  meals: MealUseCases;
  foods: FoodUseCases;
  /** The foods with a star. */
  stars: StarredFoodUseCases;
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

/** Adds a food to a meal, in three tabs: all (the search and the recents), the favorites (the foods with a star) and the user's own (foods, saved meals). */
export function AddFoodScreen({ meal, meals, foods, stars, products, camera, profile, clock, pickWhen, run, onDone }: Props) {
  const [tab, setTab] = useState<Tab>('all');
  // What the third tab lists, and whether the form that creates a food is open in it.
  const [kind, setKind] = useState<Kind>('foods');
  const [creating, setCreating] = useState(false);
  // The food whose fiche replaces the segments, with the quantity to start from when it comes from « Récents ».
  // A product of a brand that is not one of the user's foods yet has no reference.
  const [selected, setSelected] = useState<{ food: Food | FoodInput; grams?: number } | null>(null);
  const [search, setSearch] = useState<Search>({ query: '' });
  // The scan takes the place of the lists; a barcode it could not find a product for is kept for the form that creates the food.
  const [scanning, setScanning] = useState(false);
  const [scanned, setScanned] = useState<string | undefined>();
  // The product being read in full after a touch on the list; null when none.
  const [opening, setOpening] = useState<AbortController | null>(null);
  useEffect(() => () => opening?.abort(), [opening]);
  // Held here, not by the list: the products of a search are not asked again when the user comes back from a fiche. Raw or cooked leaves them out.
  const brand = useBrandProducts(products, search.query, !search.state);
  // The custom foods, live: the search, the recents and the favorites all look foods up in them. null until the first list.
  const [custom, setCustom] = useState<Food[] | null>(null);
  // Listener errors show on the SyncIcon, which watches the same user's data.
  useEffect(() => foods.observeCustom(setCustom, () => {}), [foods]);

  // The list holds a product's name, quantity and macros; its portion of the label and its vitamins are in the product itself, read before it opens.
  // If that cannot be read (offline, busy), the product opens as the list has it: the macros are there already.
  const choose = (choice: Choice) => {
    if ('food' in choice) return setSelected({ food: choice.food });
    const { product } = choice;
    if (!product.barcode) return setSelected({ food: product });
    const controller = new AbortController();
    setOpening(controller);
    products.lookup(product.barcode, controller.signal).then(
      (found) => {
        if (controller.signal.aborted) return;
        setOpening(null);
        setSelected({ food: found.kind === 'found' ? found.food : product });
      },
      () => {
        if (controller.signal.aborted) return;
        setOpening(null);
        setSelected({ food: product });
      },
    );
  };

  const create = (food: FoodInput) => {
    run(() => foods.create(food));
    setCreating(false);
    setScanned(undefined);
  };

  return (
    // Its own key for the sheet: the scroll offset of the lists must not carry over to it.
    <ScrollView key={selected ? 'sheet' : scanning ? 'scan' : opening ? 'opening' : 'lists'} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      {selected ? (
        <FoodDetail
          food={selected.food}
          grams={selected.grams}
          meal={meal}
          meals={meals}
          foods={foods}
          stars={stars}
          custom={custom ?? []}
          profile={profile}
          clock={clock}
          pickWhen={pickWhen}
          run={run}
          onDone={onDone}
          onBack={() => setSelected(null)}
          onRemoved={() => setSelected(null)}
        />
      ) : opening ? (
        <View style={styles.opening}>
          <View style={styles.loading} accessible accessibilityLiveRegion="polite">
            <ActivityIndicator size="small" />
            <Text variant="bodyLarge">Chargement du produit…</Text>
          </View>
          <Button contentStyle={styles.scan} onPress={() => setOpening(null)}>
            Retour
          </Button>
        </View>
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
            setTab('custom');
            setKind('foods');
            setCreating(true);
          }}
          onBack={() => setScanning(false)}
        />
      ) : (
        <>
          <Tabs tabs={TABS} value={tab} onChange={(key) => setTab(key as Tab)} />
          {tab === 'all' && (
            <FoodSearch
              foods={foods}
              meals={meals}
              custom={custom}
              brand={brand}
              search={search}
              onSearch={setSearch}
              onSelect={choose}
              onPickRecent={(food, grams) => setSelected({ food, grams })}
              onScan={() => setScanning(true)}
            />
          )}
          {tab === 'starred' && <StarredList stars={stars} foods={foods} custom={custom} onPick={(food) => setSelected({ food })} run={run} />}
          {tab === 'custom' && (
            <>
              <View style={styles.kinds}>
                <Chip hitSlop={HIT_SLOP} selected={kind === 'foods'} onPress={() => setKind('foods')}>
                  Aliments
                </Chip>
                <Chip hitSlop={HIT_SLOP} selected={kind === 'meals'} onPress={() => setKind('meals')}>
                  Repas
                </Chip>
              </View>
              {kind === 'foods' && !creating && <CustomFoodsList custom={custom} onPick={(food) => setSelected({ food })} onCreate={() => setCreating(true)} />}
              {kind === 'foods' && creating && (
                <>
                  <FoodForm submitLabel="Enregistrer" barcode={scanned} onSubmit={create} />
                  <Button
                    contentStyle={styles.scan}
                    onPress={() => {
                      setCreating(false);
                      // The code of a scan belongs to the food that scan was creating, not to the next one.
                      setScanned(undefined);
                    }}
                  >
                    Annuler
                  </Button>
                </>
              )}
              {kind === 'meals' && <FavoritesList meal={meal} meals={meals} foods={foods} custom={custom} run={run} onDone={onDone} />}
            </>
          )}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({ content: { padding: 16, gap: 16 }, kinds: { flexDirection: 'row', gap: 8 }, scan: { minHeight: 48 }, opening: { gap: 12 }, loading: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 48 } });
