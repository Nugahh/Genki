import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Chip, HelperText, List, Text, TextInput } from 'react-native-paper';
import type { FoodUseCases } from '../application/foodUseCases';
import { matchCustom, type Food } from '../domain/food';
import { kcalText } from './format';
import { StateChip } from './StateChip';

/** What is typed and filtered; the screen keeps it, so it survives a visit to a food's fiche. */
export type Search = { query: string; state?: 'raw' | 'cooked' };

const FILTERS: { label: string; state?: 'raw' | 'cooked' }[] = [{ label: 'Tous' }, { label: 'Cru', state: 'raw' }, { label: 'Cuit', state: 'cooked' }];
// A chip is 32 dp tall: 8 dp more above and below make the 48 dp target.
const HIT_SLOP = { top: 8, bottom: 8 };

type Props = {
  foods: FoodUseCases;
  /** The custom foods; null until the first list arrives. */
  custom: Food[] | null;
  search: Search;
  onSearch: (search: Search) => void;
  onSelect: (food: Food) => void;
};

/** The search field and its filters, then the matching custom foods followed by the Ciqual ones. */
export function FoodSearch({ foods, custom, search, onSearch, onSelect }: Props) {
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
  const results = typed ? [...matchCustom(custom ?? [], search.query, search.state), ...(answer?.found ?? [])] : [];

  return (
    <View style={styles.search}>
      <TextInput
        label="Rechercher un aliment"
        accessibilityLabel="Rechercher un aliment"
        value={search.query}
        onChangeText={(query) => onSearch({ ...search, query })}
      />
      <View style={styles.filters}>
        {FILTERS.map(({ label, state }) => (
          <Chip key={label} hitSlop={HIT_SLOP} selected={search.state === state} onPress={() => onSearch({ ...search, state })}>
            {label}
          </Chip>
        ))}
      </View>
      {!typed && <Text>Tapez le nom d’un aliment.</Text>}
      {typed && answer?.found === null && (
        <HelperText type="error" accessibilityLiveRegion="polite">
          Recherche indisponible.
        </HelperText>
      )}
      {typed && custom !== null && answer?.search === search && answer.found !== null && results.length === 0 && <Text accessibilityLiveRegion="polite">Aucun aliment trouvé.</Text>}
      {results.map((food) => (
        <List.Item
          key={`${food.ref.type}:${food.ref.id}`}
          title={food.name}
          titleNumberOfLines={2}
          description={`${kcalText(food.per100g.kcal)} kcal / 100 g`}
          right={({ style }) => <StateChip state={food.state} style={style} />}
          onPress={() => onSelect(food)}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  search: { gap: 12 },
  filters: { flexDirection: 'row', gap: 8 },
});
