import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, IconButton } from 'react-native-paper';
import type { Profile } from '@/modules/settings';
import type { Clock } from '@/shared/clock';
import type { FoodUseCases } from '../application/foodUseCases';
import type { MealUseCases } from '../application/mealUseCases';
import type { StarredFoodUseCases } from '../application/starredFoods';
import type { Food, FoodInput, StarredFood } from '../domain/food';
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
  /** A product of a brand that is not one of the user's foods yet has no reference: it becomes one when it is added. */
  food: Food | FoodInput;
  /** The quantity eaten last time, when the food comes from « Récents ». */
  grams?: number;
  meal: Meal;
  meals: MealUseCases;
  foods: FoodUseCases;
  stars: StarredFoodUseCases;
  /** The foods of the user, to find the one a product already is. */
  custom: Food[];
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
const sourceOf = (food: Food | FoodInput) => (food.source === 'off' ? 'Open Food Facts' : SOURCES[(food as Food).ref.type]);

/** A food chosen from a list: pick a quantity, a group and a time, read the figures, add it. A custom food can also be changed or deleted here. */
export function FoodDetail({ food: chosen, grams: last, meal, meals, foods, stars, custom, profile, clock, pickWhen, run, onDone, onBack, onRemoved }: Props) {
  // Held here so that a saved change shows at once.
  const [food, setFood] = useState<Food | FoodInput>(chosen);
  // The food of the user it is, once it has a reference.
  const owned = 'ref' in food ? food : undefined;
  const [starred, setStarred] = useState<StarredFood[]>([]);
  // Listener errors show on the SyncIcon, which watches the same user's data.
  useEffect(() => stars.observe(setStarred, () => {}), [stars]);
  const isStarred = owned ? stars.isStarred(starred, owned.ref) : false;
  const toggleStar = () => {
    if (owned) return run(() => (isStarred ? stars.unstar(owned.ref) : stars.star({ ref: owned.ref, name: owned.name })));
    // A product of a brand is starred as a food of the user's: it becomes one first (and then it is the food of the fiche).
    let adoption: ReturnType<typeof foods.adopt>;
    try {
      adoption = foods.adopt(food, custom);
    } catch (error) {
      return run(async () => {
        throw error;
      });
    }
    setFood(adoption.food);
    run(async () => {
      await Promise.all([adoption.write(), stars.star({ ref: adoption.food.ref, name: adoption.food.name })]);
    });
  };
  const [editing, setEditing] = useState(false);
  const [removing, setRemoving] = useState(false);
  // Set by the first touch of « Ajouter à … »: a second one, before the host has left the screen, must not log the food again.
  const submitted = useRef(false);

  const quantities = [
    // The label of a product's portion says its weight already (« 330 ml ≈ 330 g »).
    ...food.portions.map((portion) => ({ label: food.source === 'off' ? portion.label : `${portion.label} (${gramsText(portion.grams)} g)`, grams: portion.grams })),
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
              if (!owned) return;
              run(() => foods.update(owned.ref.id, input));
              setFood({ ref: owned.ref, ...input });
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
        action={
          <IconButton
            icon={isStarred ? 'star' : 'star-outline'}
            style={styles.star}
            accessibilityLabel={isStarred ? 'Retirer des favoris' : 'Mettre en favori'}
            onPress={toggleStar}
          />
        }
          source={sourceOf(food)}
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
            if (owned) {
              run(() => meals.logFood(chosenMeal, owned, grams, at));
            } else {
              // A product becomes a food of the user's, and the line refers to it. Made once, on the first run: a retry writes the same food again,
              // never a second one. The two writes are not awaited one after the other: offline they settle together.
              let adoption: ReturnType<typeof foods.adopt> | undefined;
              run(async () => {
                adoption ??= foods.adopt(food, custom);
                await Promise.all([adoption.write(), meals.logFood(chosenMeal, adoption.food, grams, at)]);
              });
            }
            onDone();
          }}
        >
          {owned?.ref.type === 'custom' && (
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
            if (!owned) return;
            run(() => foods.remove(owned.ref.id));
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
  // Paper's icon button is 40 dp, and its container clips the extra hit area: 48 dp make the touch target.
  star: { width: 48, height: 48, borderRadius: 24 },
  button: { minHeight: 48 },
});
