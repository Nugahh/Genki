import { useState } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { Button, Chip, Text, TextInput } from 'react-native-paper';
import type { FoodUseCases } from '../application/foodUseCases';
import type { MealUseCases } from '../application/mealUseCases';
import type { Food, FoodState } from '../domain/food';
import { macrosFor } from '../domain/macros';
import type { Meal } from '../domain/meal';
import { FoodForm } from './FoodForm';
import { gramsText, macrosText, MEAL_LABELS, parseNumber } from './format';

/** « cru » or « cuit » beside a food; nothing for a food that is neither. */
export function StateChip({ state, style }: { state: FoodState; style?: ViewStyle }) {
  if (state === 'other') return null;
  return (
    <Chip compact accessibilityRole="text" style={style}>
      {state === 'raw' ? 'cru' : 'cuit'}
    </Chip>
  );
}

const asText = (n: number) => String(n).replace('.', ',');
// A chip is 32 dp tall: 8 dp more above and below make the 48 dp target.
const HIT_SLOP = { top: 8, bottom: 8 };

type Props = {
  food: Food;
  /** The quantity eaten last time, when the food comes from « Récents ». */
  grams?: number;
  meal: Meal;
  meals: MealUseCases;
  foods: FoodUseCases;
  run: (write: () => Promise<void>) => void;
  onDone: () => void;
  onBack: () => void;
  /** The custom food was deleted. */
  onRemoved: () => void;
};

/** A food chosen from a list: pick a quantity, read the macros, add it to the meal. A custom food can also be changed or deleted here. */
export function FoodDetail({ food: chosen, grams: last, meal, meals, foods, run, onDone, onBack, onRemoved }: Props) {
  // Held here so that a saved change shows at once.
  const [food, setFood] = useState(chosen);
  const [text, setText] = useState(asText(last ?? 100));
  const [editing, setEditing] = useState(false);
  const grams = parseNumber(text);
  const valid = grams > 0 && grams <= 5000;

  if (editing) {
    return (
      <View style={styles.detail}>
        <FoodForm
          initial={food}
          submitLabel="Enregistrer les modifications"
          onSubmit={(input) => {
            run(() => foods.update(food.ref.id, input));
            setFood({ ref: food.ref, ...input });
            setEditing(false);
          }}
        />
        <Button contentStyle={styles.button} onPress={() => setEditing(false)}>
          Annuler
        </Button>
      </View>
    );
  }

  const quantities = [
    ...food.portions.map((portion) => ({ label: `${portion.label} (${gramsText(portion.grams)} g)`, grams: portion.grams })),
    { label: '100 g', grams: 100 },
    ...(last !== undefined && last !== 100 ? [{ label: `${gramsText(last)} g`, grams: last }] : []),
  ];

  return (
    <View style={styles.detail}>
      <View style={styles.title}>
        <Text variant="titleLarge" style={styles.name}>
          {food.name}
        </Text>
        <StateChip state={food.state} />
      </View>
      <View style={styles.chips}>
        {quantities.map((quantity, i) => (
          <Chip key={i} hitSlop={HIT_SLOP} onPress={() => setText(asText(quantity.grams))}>
            {quantity.label}
          </Chip>
        ))}
      </View>
      <TextInput label="Quantité (g)" accessibilityLabel="Quantité (g)" value={text} onChangeText={setText} keyboardType="decimal-pad" />
      {valid && <Text variant="bodyLarge">{macrosText(macrosFor(food.per100g, grams))}</Text>}
      <Button
        mode="contained"
        contentStyle={styles.button}
        disabled={!valid}
        onPress={() => {
          run(() => meals.logFood(meal, food, grams));
          onDone();
        }}
      >
        {`Ajouter à ${MEAL_LABELS[meal]}`}
      </Button>
      {food.ref.type === 'custom' && (
        <>
          <Button mode="outlined" icon="pencil" contentStyle={styles.button} onPress={() => setEditing(true)}>
            Modifier l’aliment
          </Button>
          <Button
            mode="outlined"
            icon="delete-outline"
            contentStyle={styles.button}
            onPress={() => {
              run(() => foods.remove(food.ref.id));
              onRemoved();
            }}
          >
            Supprimer l’aliment
          </Button>
        </>
      )}
      <Button contentStyle={styles.button} onPress={onBack}>
        Retour
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  detail: { gap: 12 },
  title: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { flexShrink: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  button: { minHeight: 48 },
});
