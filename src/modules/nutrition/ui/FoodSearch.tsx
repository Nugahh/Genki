import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { ActivityIndicator, Button, Chip, HelperText, List, Text, TextInput } from 'react-native-paper';
import type { FoodUseCases } from '../application/foodUseCases';
import { matchCustom, type Food, type FoodInput } from '../domain/food';
import { relevance } from '../domain/relevance';
import { kcalText, productQuantity } from './format';
import { StateChip } from './StateChip';
import type { BrandProducts } from './useBrandProducts';

/** What is typed and filtered; the screen keeps it, so it survives a visit to a food's fiche. */
export type Search = {
  query: string;
  state?: 'raw' | 'cooked';
  /** Set when the screen filled the field itself (the name of a food just created): no products are asked for what the user did not type. */
  quiet?: boolean;
};

/** What a result opens: a food of the user's or of Ciqual, or a product of a brand that is not one of the user's foods yet. */
export type Choice = { food: Food } | { product: FoodInput };

const FILTERS: { label: string; state?: 'raw' | 'cooked' }[] = [{ label: 'Tous' }, { label: 'Cru', state: 'raw' }, { label: 'Cuit', state: 'cooked' }];
// A chip is 32 dp tall: 8 dp more above and below make the 48 dp target.
const HIT_SLOP = { top: 8, bottom: 8 };

type Props = {
  foods: FoodUseCases;
  /** The custom foods; null until the first list arrives. */
  custom: Food[] | null;
  /** The products of brands for this search, asked by the screen. */
  brand: BrandProducts;
  search: Search;
  onSearch: (search: Search) => void;
  onSelect: (choice: Choice) => void;
};

type Candidate = { key: string; food: Food | FoodInput; choice: Choice; score: number; rank: number };

/** The one line under a name: « 330 ml · Coca-Cola · 42 kcal / 100 g » for a product, « 350 kcal / 100 g » for the other foods. */
const describe = (food: Food | FoodInput) =>
  food.source === 'off'
    ? [productQuantity(food.portions) ?? '100 g', food.brand, `${kcalText(food.per100g.kcal)} kcal / 100 g`].filter(Boolean).join(' · ')
    : `${kcalText(food.per100g.kcal)} kcal / 100 g`;

/** One search field for Ciqual, the foods of the user and the products of brands, ranked by relevance; the two first answer at once, the products when the network does. */
export function FoodSearch({ foods, custom, brand, search, onSearch, onSelect }: Props) {
  // The Ciqual foods found (null when the catalog failed), and the search they answer: until that is the current one, « Aucun aliment trouvé. » would be a guess.
  const [answer, setAnswer] = useState<{ search: Search; found: Food[] | null } | null>(null);
  useEffect(() => {
    // A newer search replaces this one: its answer, if it comes late, must not land.
    let stale = false;
    const done = (found: Food[] | null) => {
      if (!stale) setAnswer({ search, found });
    };
    foods.searchCatalog(search.query, search.state).then(done, (error) => {
      console.warn(error);
      done(null);
    });
    return () => {
      stale = true;
    };
  }, [foods, search]);

  const typed = search.query.trim() !== '';
  const owned = new Set((custom ?? []).flatMap((f) => (f.barcode ? [f.barcode] : [])));
  // Ties go to Ciqual, then to the foods of the user, then to the products of brands.
  const candidates: Candidate[] = typed
    ? [
        ...(answer?.found ?? []).map((food): Candidate => ({ key: `ciqual:${food.ref.id}`, food, choice: { food }, score: 0, rank: 0 })),
        ...matchCustom(custom ?? [], search.query, search.state).map((food): Candidate => ({ key: `custom:${food.ref.id}`, food, choice: { food }, score: 0, rank: 1 })),
        // A product the user already has shows as theirs.
        ...brand.foods.filter((p) => !p.barcode || !owned.has(p.barcode)).map((product, i): Candidate => ({ key: `off:${product.barcode ?? i}`, food: product, choice: { product }, score: 0, rank: 2 })),
      ]
    : [];
  const results = candidates
    .map((c) => ({ ...c, score: relevance(search.query, c.food.name, c.food.brand) }))
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score || a.rank - b.rank || a.food.name.localeCompare(b.food.name, 'fr'));

  return (
    <View style={styles.search}>
      <TextInput
        label="Rechercher un aliment"
        accessibilityLabel="Rechercher un aliment"
        value={search.query}
        onChangeText={(query) => onSearch({ query, state: search.state })}
      />
      <View style={styles.filters}>
        {FILTERS.map(({ label, state }) => (
          <Chip key={label} hitSlop={HIT_SLOP} selected={search.state === state} onPress={() => onSearch({ ...search, state })}>
            {label}
          </Chip>
        ))}
      </View>
      {!typed && <Text>Tape le nom d’un aliment.</Text>}
      {typed && answer?.found === null && (
        <HelperText type="error" accessibilityLiveRegion="polite">
          Recherche indisponible.
        </HelperText>
      )}
      {results.map((c) => (
        <List.Item
          key={c.key}
          title={c.food.name}
          titleNumberOfLines={2}
          description={describe(c.food)}
          descriptionNumberOfLines={2}
          right={({ style }) =>
            c.food.source === 'off' ? (
              <Text variant="labelSmall" style={[style, styles.source]}>
                Open Food Facts
              </Text>
            ) : (
              <StateChip state={c.food.state} style={style} />
            )
          }
          onPress={() => onSelect(c.choice)}
        />
      ))}
      {brand.status === 'pending' && (
        <View style={styles.status} accessible accessibilityLiveRegion="polite">
          <ActivityIndicator size="small" />
          <Text>Recherche de produits…</Text>
        </View>
      )}
      {brand.status === 'failed' && (
        <View style={styles.status}>
          <Text accessibilityLiveRegion="polite" style={styles.statusText}>
            Produits de marque indisponibles pour le moment (hors-ligne ou service occupé).
          </Text>
          {brand.retry && (
            <Button compact contentStyle={styles.button} onPress={brand.retry}>
              Réessayer
            </Button>
          )}
        </View>
      )}
      {typed && custom !== null && answer?.search === search && answer.found !== null && results.length === 0 && brand.status !== 'pending' && (
        <Text accessibilityLiveRegion="polite">Aucun aliment trouvé.</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  search: { gap: 12 },
  filters: { flexDirection: 'row', gap: 8 },
  status: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 48 },
  source: { alignSelf: 'center' },
  statusText: { flex: 1 },
  button: { minHeight: 48 },
});
