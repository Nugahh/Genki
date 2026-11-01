import { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button } from 'react-native-paper';
import type { Profile } from '@/modules/settings';
import type { Clock } from '@/shared/clock';
import type { FoodUseCases } from '../application/foodUseCases';
import type { MealUseCases } from '../application/mealUseCases';
import type { Food } from '../domain/food';
import { macrosFor } from '../domain/macros';
import type { Meal } from '../domain/meal';
import { nutrientsFor } from '../domain/nutrients';
import { ConfirmDelete } from './ConfirmDelete';
import { FoodForm } from './FoodForm';
import { gramsText, MEAL_LABELS } from './format';
import { PortionSheet } from './PortionSheet';
import { StateChip } from './StateChip';
import type { PickWhen } from './WhenPicker';

type Props = {
  food: Food;
  /** The quantity eaten last time, when the food comes from « Récents ». */
  grams?: number;
  meal: Meal;
  meals: MealUseCases;
  foods: FoodUseCases;
  profile: Profile;
  clock: Clock;
  pickWhen: PickWhen;
  run: (write: () => Promise<void>) => void;
  onDone: () => void;
  onBack: () => void;
  /** The custom food was deleted. */
  onRemoved: () => void;
};

const SOURCES = { ciqual: 'Ciqual (ANSES)', custom: 'Mon aliment' } as const;

/** A food chosen from a list: pick a quantity, a group and a time, read the figures, add it. A custom food can also be changed or deleted here. */
export function FoodDetail({ food: chosen, grams: last, meal, meals, foods, profile, clock, pickWhen, run, onDone, onBack, onRemoved }: Props) {
  // Held here so that a saved change shows at once.
  const [food, setFood] = useState(chosen);
  const [editing, setEditing] = useState(false);
  const [removing, setRemoving] = useState(false);
  // Set by the first touch of « Ajouter à … »: a second one, before the host has left the screen, must not log the food again.
  const submitted = useRef(false);

  const quantities = [
    ...food.portions.map((portion) => ({ label: `${portion.label} (${gramsText(portion.grams)} g)`, grams: portion.grams })),
    { label: '100 g', grams: 100 },
    ...(last !== undefined && last !== 100 ? [{ label: `${gramsText(last)} g`, grams: last }] : []),
  ];

  return (
    <>
      {editing && (
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
      )}
      {/* Hidden, not unmounted, while the food is edited: the quantity, group and time typed so far stay. */}
      <View style={editing ? styles.hidden : undefined}>
        <PortionSheet
          name={food.name}
          badge={<StateChip state={food.state} />}
          source={SOURCES[food.ref.type]}
          portions={quantities}
          initialGrams={last ?? 100}
          macrosAt={(grams) => macrosFor(food.per100g, grams)}
          nutrientsAt={(grams) => food.nutrients && nutrientsFor(food.nutrients, grams)}
          initialMeal={meal}
          meals={meals}
          profile={profile}
          clock={clock}
          pickWhen={pickWhen}
          submitLabel={(chosenMeal) => `Ajouter à ${MEAL_LABELS[chosenMeal]}`}
          onSubmit={({ grams, meal: chosenMeal, at }) => {
            if (submitted.current) return;
            submitted.current = true;
            run(() => meals.logFood(chosenMeal, food, grams, at));
            onDone();
          }}
        >
          {food.ref.type === 'custom' && (
            <>
              <Button mode="outlined" icon="pencil" contentStyle={styles.button} onPress={() => setEditing(true)}>
                Modifier l’aliment
              </Button>
              <Button mode="outlined" icon="delete-outline" contentStyle={styles.button} onPress={() => setRemoving(true)}>
                Supprimer l’aliment
              </Button>
            </>
          )}
          <Button contentStyle={styles.button} onPress={onBack}>
            Retour
          </Button>
        </PortionSheet>
      </View>
      {removing && (
        <ConfirmDelete
          title={`Supprimer l’aliment ${food.name} ?`}
          onCancel={() => setRemoving(false)}
          onConfirm={() => {
            run(() => foods.remove(food.ref.id));
            onRemoved();
          }}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  detail: { gap: 12 },
  hidden: { display: 'none' },
  button: { minHeight: 48 },
});
