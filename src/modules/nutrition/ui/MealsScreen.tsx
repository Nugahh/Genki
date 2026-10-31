import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, Dialog, List, Portal, Surface, Text, TextInput } from 'react-native-paper';
import type { Profile } from '@/modules/settings';
import { dayKey, type Clock } from '@/shared/clock';
import { useNow } from '@/shared/useNow';
import type { MealUseCases } from '../application/mealUseCases';
import type { FoodEntry } from '../domain/food';
import { sumMacros } from '../domain/macros';
import { MEALS, type Meal } from '../domain/meal';
import { EntryActions } from './EntryActions';
import { gramsText, kcalText, MEAL_LABELS } from './format';

type Props = {
  profile: Profile;
  clock: Clock;
  meals: MealUseCases;
  onAdd: (meal: Meal) => void;
  /** Runs a write; a rejected one is offered again with « Réessayer » (spec §8). */
  run: (write: () => Promise<void>) => void;
};

/** Today's journal: the day totals, then one section per meal. */
export function MealsScreen({ profile, clock, meals, onAdd, run }: Props) {
  const now = useNow(clock);
  const day = dayKey(now, profile.timezone);
  const [entries, setEntries] = useState<FoodEntry[]>([]);
  const [selected, setSelected] = useState<FoodEntry | null>(null);
  // The favorite being named; null while the dialog is closed.
  const [favorite, setFavorite] = useState<{ meal: Meal; name: string } | null>(null);
  // Listener errors show on the SyncIcon, which watches the same user's data.
  useEffect(() => meals.observeDay(day, setEntries, () => {}), [meals, day]);

  const total = sumMacros(entries.map((e) => e.macros));
  const saveFavorite = ({ meal, name }: { meal: Meal; name: string }) => {
    run(() => meals.saveFavorite(name, entries.filter((e) => e.meal === meal)));
    setFavorite(null);
  };

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Surface style={styles.card}>
        <Text variant="titleMedium">{`Calories : ${kcalText(total.kcal)} / ${kcalText(profile.goals.kcal)} kcal`}</Text>
        <Text variant="titleMedium">{`Protéines : ${gramsText(total.protein)} / ${gramsText(profile.goals.proteinG)} g`}</Text>
        <Text variant="bodyMedium">{`Glucides ${gramsText(total.carbs)} g · Lipides ${gramsText(total.fat)} g`}</Text>
      </Surface>
      {MEALS.map((meal) => {
        const label = MEAL_LABELS[meal];
        const list = entries.filter((e) => e.meal === meal);
        return (
          <Surface key={meal} style={styles.card} testID={`meal-${meal}`}>
            <View style={styles.header}>
              <View>
                <Text variant="titleMedium" accessibilityRole="header">{label}</Text>
                <Text variant="bodyMedium">{`${kcalText(sumMacros(list.map((e) => e.macros)).kcal)} kcal`}</Text>
              </View>
              <Button mode="contained-tonal" icon="plus" accessibilityLabel={`Ajouter à ${label}`} contentStyle={styles.button} onPress={() => onAdd(meal)}>
                Ajouter
              </Button>
            </View>
            {list.length === 0 && <Text>Rien pour l’instant.</Text>}
            {list.map((entry) => (
              <List.Item
                key={entry.id}
                title={entry.foodName}
                titleNumberOfLines={3}
                description={`${gramsText(entry.grams)} g · ${kcalText(entry.macros.kcal)} kcal`}
                right={(props) => <List.Icon {...props} icon="chevron-right" />}
                accessibilityLabel={`${entry.foodName}, ${gramsText(entry.grams)} g, ${kcalText(entry.macros.kcal)} kcal`}
                onPress={() => setSelected(entry)}
              />
            ))}
            {list.length > 0 && (
              <Button icon="star-outline" accessibilityLabel={`Enregistrer comme favori, ${label}`} contentStyle={styles.button} onPress={() => setFavorite({ meal, name: label })}>
                Enregistrer comme favori
              </Button>
            )}
          </Surface>
        );
      })}
      <EntryActions
        entry={selected}
        onDismiss={() => setSelected(null)}
        onChangeGrams={(entry, grams) => run(() => meals.changeGrams(entry, grams))}
        onRemove={(entry) => run(() => meals.removeEntry(entry))}
      />
      {favorite && (
        <Portal>
          <Dialog visible onDismiss={() => setFavorite(null)}>
            <Dialog.Title>Nom du favori</Dialog.Title>
            <Dialog.Content>
              <TextInput label="Nom" accessibilityLabel="Nom" maxLength={100} value={favorite.name} onChangeText={(name) => setFavorite({ ...favorite, name })} />
            </Dialog.Content>
            <Dialog.Actions>
              <Button contentStyle={styles.button} onPress={() => setFavorite(null)}>
                Annuler
              </Button>
              <Button contentStyle={styles.button} disabled={favorite.name.trim() === ''} onPress={() => saveFavorite(favorite)}>
                Enregistrer
              </Button>
            </Dialog.Actions>
          </Dialog>
        </Portal>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 16 },
  card: { padding: 16, gap: 8, borderRadius: 12 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  button: { minHeight: 48 },
});
