import { useState } from 'react';
import { StyleSheet } from 'react-native';
import { Button } from 'react-native-paper';
import type { Profile } from '@/modules/settings';
import type { Clock } from '@/shared/clock';
import type { MealUseCases } from '../application/mealUseCases';
import type { FoodEntry } from '../domain/food';
import { scaleMacros } from '../domain/macros';
import { scaleNutrients } from '../domain/nutrients';
import { ConfirmDelete } from './ConfirmDelete';
import { gramsText } from './format';
import { PortionSheet } from './PortionSheet';
import type { PickWhen } from './WhenPicker';

type Props = {
  entry: FoodEntry;
  meals: MealUseCases;
  profile: Profile;
  clock: Clock;
  pickWhen: PickWhen;
  run: (write: () => Promise<void>) => void;
  /** The entry was saved or removed: the host leaves the sheet. */
  onDone: () => void;
  onBack: () => void;
};

const SOURCES = { ciqual: 'Ciqual (ANSES)', custom: 'Mon aliment' } as const;

/** The sheet of a line of the journal: its quantity, group, day and time can change, or the line can be removed (spec §6, instead of swiping). */
export function EntryDetail({ entry, meals, profile, clock, pickWhen, run, onDone, onBack }: Props) {
  const [removing, setRemoving] = useState(false);
  const portions = [
    { label: '100 g', grams: 100 },
    ...(entry.grams !== 100 ? [{ label: `${gramsText(entry.grams)} g`, grams: entry.grams }] : []),
  ];

  return (
    <>
      <PortionSheet
        name={entry.foodName}
        source={SOURCES[entry.foodRef.type]}
        portions={portions}
        initialGrams={entry.grams}
        // From the values frozen into the entry, not from the food as it is now (spec §4 rule 5).
        macrosAt={(grams) => scaleMacros(entry.macros, entry.grams, grams)}
        nutrientsAt={(grams) => entry.nutrients && scaleNutrients(entry.nutrients, entry.grams, grams)}
        initialMeal={entry.meal}
        initialAt={entry.createdAt}
        entryId={entry.id}
        meals={meals}
        profile={profile}
        clock={clock}
        pickWhen={pickWhen}
        submitLabel={() => 'Enregistrer'}
        onSubmit={({ grams, meal, at }) => {
          run(() => meals.updateEntry(entry, { grams, meal, at: at ?? entry.createdAt }));
          onDone();
        }}
      >
        <Button mode="outlined" icon="delete-outline" contentStyle={styles.button} onPress={() => setRemoving(true)}>
          Supprimer
        </Button>
        <Button contentStyle={styles.button} onPress={onBack}>
          Retour
        </Button>
      </PortionSheet>
      {removing && (
        <ConfirmDelete
          title={`Supprimer ${entry.foodName} du journal ?`}
          onCancel={() => setRemoving(false)}
          onConfirm={() => {
            run(() => meals.removeEntry(entry));
            onDone();
          }}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({ button: { minHeight: 48 } });
